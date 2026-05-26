/**
 * HeadlessAudioEngine
 *
 * Native Web Audio API sonic intervention layer for AuraFlow-Clinical.
 *
 * Two simultaneous channels:
 *   1. A continuous binaural carrier whose pitch + beat frequency are
 *      modulated by the WasmCalmnessModel score (0.0 - 1.0).
 *   2. Transient, stereo-panned Solfeggio chimes triggered by
 *      WasmAlphaBumpDetector state transitions.
 *
 * The engine is headless: it owns no DOM. SomaticMonitor (or any other
 * subscriber) calls `pushCalmness(score)` / `triggerAlphaBump()` from its
 * telemetry handler and renders the Canvas independently.
 *
 * Autoplay policy: `AudioContext` is constructed lazily inside `start()`,
 * which MUST be invoked from a user-gesture handler (the Connect button in
 * DeviceSelection). A separate constructor avoids touching the audio
 * subsystem until the operator has opted in.
 */

export const SOLFEGGIO_FREQUENCIES = [396, 417, 528, 639, 741, 852] as const;
export type SolfeggioFrequency = (typeof SOLFEGGIO_FREQUENCIES)[number];

export interface CalmnessTelemetry {
  calmnessScore: number;
  alphaBumpDetected: boolean;
  timestamp: number;
}

/** Unsubscribe handle. */
export type Unsubscribe = () => void;

interface EngineConfig {
  /** Master output gain. Defaults to 0.18 — clinical use, never near peak. */
  masterGain?: number;
  /** Smoothing time constant (seconds) for carrier parameter ramps. */
  rampSeconds?: number;
}

/**
 * Map calmness score → binaural carrier configuration.
 *
 * Higher calmness pulls the carrier into a lower, warmer band and slows the
 * binaural beat into the alpha range (8-12 Hz). Low calmness raises the
 * carrier and pushes the beat toward low-beta (~14 Hz) to gently re-engage
 * attention.
 *
 * Inputs assumed already clamped to [0, 1].
 */
function carrierForCalmness(calmness: number): { carrier: number; beat: number } {
  // Carrier: 240 Hz (alert) → 140 Hz (settled).
  const carrier = 240 - calmness * 100;
  // Beat: 14 Hz (low-beta) → 8 Hz (mid-alpha).
  const beat = 14 - calmness * 6;
  return { carrier, beat };
}

export class HeadlessAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;

  // Binaural carrier graph
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private leftMerge: ChannelMergerNode | null = null;
  private leftGain: GainNode | null = null;
  private rightGain: GainNode | null = null;

  // Chime suppression: alpha bumps fire on every qualifying frame, so debounce
  // so we don't spawn 30 chimes per second of detector noise.
  private lastChimeAt = 0;
  private chimeCooldownMs = 1200;
  private chimeIndex = 0;

  // Subscribers — anyone (telemetry buffers, UI, tests) can listen to the
  // last-seen telemetry tick.
  private subscribers = new Set<(t: CalmnessTelemetry) => void>();

  // Last applied targets, so we can avoid scheduling redundant ramps when
  // the calmness score is noisy but unchanged.
  private lastCarrierHz = -1;
  private lastBeatHz = -1;

  private running = false;

  constructor(private readonly config: EngineConfig = {}) {}

  /**
   * Initialize and start the audio graph. Must be called from a user-gesture
   * handler (the Connect button) so the browser allows playback.
   *
   * Idempotent — re-calling after start is a no-op.
   */
  async start(): Promise<void> {
    if (this.running) return;

    const Ctor =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctor) {
      throw new Error('Web Audio API unavailable in this environment.');
    }

    const ctx = new Ctor();
    // Safari occasionally returns the context in "suspended" state even from a
    // user gesture; resume() inside the same gesture is the documented unlock.
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const master = ctx.createGain();
    // Master starts silent and eases in like a slow exhale — see ramp below.
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Per-ear gain so we can fade carriers without re-creating oscillators.
    // Per-ear is set to its steady-state value; the audible fade-in is
    // driven entirely by the master ramp so the curve stays monotonic.
    const leftGain = ctx.createGain();
    const rightGain = ctx.createGain();
    leftGain.gain.value = 0.5;
    rightGain.gain.value = 0.5;

    const merger = ctx.createChannelMerger(2);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);
    merger.connect(master);

    const leftOsc = ctx.createOscillator();
    const rightOsc = ctx.createOscillator();
    leftOsc.type = 'sine';
    rightOsc.type = 'sine';

    // Seed carrier at the mid-calmness target so the first ramp is small.
    const { carrier, beat } = carrierForCalmness(0.5);
    leftOsc.frequency.value = carrier;
    rightOsc.frequency.value = carrier + beat;

    leftOsc.connect(leftGain);
    rightOsc.connect(rightGain);

    const now = ctx.currentTime;
    leftOsc.start(now);
    rightOsc.start(now);

    // 3.5-second linear ramp on the master gain from 0 → 1.0 — a slow
    // "exhale" onset after the operator hits Connect.
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(1.0, now + 3.5);

    this.ctx = ctx;
    this.masterGainNode = master;
    this.leftOsc = leftOsc;
    this.rightOsc = rightOsc;
    this.leftGain = leftGain;
    this.rightGain = rightGain;
    this.leftMerge = merger;
    this.lastCarrierHz = carrier;
    this.lastBeatHz = beat;
    this.running = true;
  }

  /** Whether the audio context is live. */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Subscribe to the live telemetry stream. The engine itself pushes every
   * call to `pushCalmness` / `triggerAlphaBump` here so UI consumers can
   * tap the same source-of-truth that drives the audio graph.
   */
  subscribe(listener: (t: CalmnessTelemetry) => void): Unsubscribe {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  /**
   * Push a calmness telemetry sample. Updates the binaural carrier with a
   * smooth ramp so the operator hears the intervention follow the EEG
   * envelope rather than stepping abruptly.
   */
  pushCalmness(telemetry: CalmnessTelemetry): void {
    // Always fan out to subscribers, even before audio is started, so UI
    // layers can use the engine as their pub/sub bus.
    for (const sub of this.subscribers) sub(telemetry);

    if (!this.running || !this.ctx || !this.leftOsc || !this.rightOsc) return;

    const clamped = Math.max(0, Math.min(1, telemetry.calmnessScore));
    const { carrier, beat } = carrierForCalmness(clamped);

    // Skip near-no-op updates — saves on AudioParam scheduling churn when
    // calmness oscillates within a hair of itself.
    if (
      Math.abs(carrier - this.lastCarrierHz) < 0.25 &&
      Math.abs(beat - this.lastBeatHz) < 0.05
    ) {
      return;
    }

    const ramp = this.config.rampSeconds ?? 0.4;
    const target = this.ctx.currentTime + ramp;
    this.leftOsc.frequency.linearRampToValueAtTime(carrier, target);
    this.rightOsc.frequency.linearRampToValueAtTime(carrier + beat, target);

    this.lastCarrierHz = carrier;
    this.lastBeatHz = beat;

    if (telemetry.alphaBumpDetected) {
      this.triggerAlphaBump();
    }
  }

  /**
   * Trigger a spatialized Solfeggio chime. Cycles through the canonical
   * frequency set and alternates pan position so successive bumps spread
   * across the stereo field.
   */
  triggerAlphaBump(): void {
    if (!this.running || !this.ctx || !this.masterGainNode) return;

    const now = Date.now();
    if (now - this.lastChimeAt < this.chimeCooldownMs) return;
    this.lastChimeAt = now;

    const ctx = this.ctx;
    const freq = SOLFEGGIO_FREQUENCIES[this.chimeIndex % SOLFEGGIO_FREQUENCIES.length];
    this.chimeIndex += 1;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Add a quiet octave-up overtone for bell-like timbre.
    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.value = freq * 2;
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.18;

    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    // PannerNode with HRTF gives genuine spatialization. The position rotates
    // around the listener so successive chimes appear from new locations.
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 8;
    panner.rolloffFactor = 1;
    const angle = (this.chimeIndex * Math.PI) / 3;
    const radius = 2.5;
    if (panner.positionX) {
      // Modern API
      panner.positionX.value = Math.sin(angle) * radius;
      panner.positionY.value = 0.5;
      panner.positionZ.value = Math.cos(angle) * radius;
    } else {
      // Legacy fallback for older Safari.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (panner as any).setPosition(Math.sin(angle) * radius, 0.5, Math.cos(angle) * radius);
    }

    osc.connect(envelope);
    overtone.connect(overtoneGain).connect(envelope);
    envelope.connect(panner).connect(this.masterGainNode);

    const t = ctx.currentTime;
    const attack = 0.05;
    const decay = 2.4;
    const peak = 0.55;
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(peak, t + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);

    osc.start(t);
    overtone.start(t);
    osc.stop(t + attack + decay + 0.05);
    overtone.stop(t + attack + decay + 0.05);

    // Disconnect after the tail so we don't leak nodes.
    osc.onended = () => {
      try {
        osc.disconnect();
        overtone.disconnect();
        overtoneGain.disconnect();
        envelope.disconnect();
        panner.disconnect();
      } catch {
        // already detached
      }
    };
  }

  /**
   * Tear down the audio graph. Safe to call repeatedly.
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;

    try {
      this.leftGain?.gain.cancelScheduledValues(now);
      this.rightGain?.gain.cancelScheduledValues(now);
      this.leftGain?.gain.linearRampToValueAtTime(0, now + 0.4);
      this.rightGain?.gain.linearRampToValueAtTime(0, now + 0.4);
      this.leftOsc?.stop(now + 0.45);
      this.rightOsc?.stop(now + 0.45);
    } catch {
      // graph may already be torn down
    }

    setTimeout(() => {
      try {
        this.leftOsc?.disconnect();
        this.rightOsc?.disconnect();
        this.leftGain?.disconnect();
        this.rightGain?.disconnect();
        this.leftMerge?.disconnect();
        this.masterGainNode?.disconnect();
        void ctx.close();
      } catch {
        // ignore
      }
      this.ctx = null;
      this.leftOsc = null;
      this.rightOsc = null;
      this.leftGain = null;
      this.rightGain = null;
      this.leftMerge = null;
      this.masterGainNode = null;
    }, 500);
  }
}

export default HeadlessAudioEngine;
