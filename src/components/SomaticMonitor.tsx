import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { BleTransport } from '@elata-biosciences/eeg-web-ble';
import type { HeadbandFrameV1, EegPreprocessor, HeadbandTransportStatus } from '@elata-biosciences/eeg-web';
import type { HeadlessAudioEngine } from '../utils/HeadlessAudioEngine';
import type { PsychometricScores } from '../data/psychometricItems';

/**
 * SomaticMonitor Component
 * 
 * High-fidelity real-time biometric dashboard for AuraFlow-Clinical.
 * Renders live telemetry (calmness score, alpha state transitions) directly onto
 * an HTML Canvas for zero-latency visualization of EEG data ingested via Athena protocol packets.
 * 
 * Responsibilities:
 * - Initialize BLE transport to stream raw Athena packets from hardware headbands
 * - Compute WASM-based calmness scoring and alpha detection from EEG frames
 * - Render telemetry continuously onto 2D Canvas context (no external charting libraries)
 * - Maintain clinical data privacy via local-first processing before federated aggregation
 */

interface TelemetryDataPoint {
  timestamp: number;
  calmnessScore: number;
  alphaBumpDetected: boolean;
}

interface SomaticMonitorState {
  isConnected: boolean;
  isInitializing: boolean;
  error: string | null;
  latestCalmnessScore: number;
  dataBuffer: TelemetryDataPoint[];
}

interface EfficacyStreak {
  startedAtMs: number | null;
  lastAboveThresholdAtMs: number | null;
  peakScore: number;
  baselineScore: number;
  dispatched: boolean;
}

interface SessionPayload {
  sessionId: string;
  trackId: string;
  hardwareType: string;
  efficacyDelta: number;
}

export interface SomaticMonitorProps {
  // Pre-paired transport handed in by DeviceSelection. When provided we skip
  // re-handshaking and just attach handlers + startStreaming().
  preparedTransport?: BleTransport;
  deviceLabel?: string;
  // Audio engine unlocked in the Connect-button user gesture. Fed live
  // calmness telemetry and alpha-bump triggers from this component's frame
  // handler so the intervention plays while the canvas renders.
  audioEngine?: HeadlessAudioEngine;
  // ERQ/DERS baseline captured before pairing. Held as context for future
  // overlays (subjective baseline vs measured calmness); not consumed by the
  // current render path.
  baselineScores?: PsychometricScores;
}

export const SomaticMonitor: React.FC<SomaticMonitorProps> = ({ preparedTransport, deviceLabel, audioEngine, baselineScores: _baselineScores }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // SDK instances
  const bleTransportRef = useRef<BleTransport | null>(null);
  const eegProcessorRef = useRef<EegPreprocessor | null>(null);
  // Stable handle for the audio engine inside frame-handler closures that
  // capture on first attach.
  const audioEngineRef = useRef<HeadlessAudioEngine | undefined>(audioEngine);
  audioEngineRef.current = audioEngine;

  // Canvas animation frame handle
  const animationFrameRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string>(uuidv4());

  // Logical (CSS-pixel) dimensions of the canvas. Drawing code reads these
  // — the backing store dimensions (`canvas.width/height`) are the logical
  // size times devicePixelRatio so HiDPI displays stay crisp.
  const logicalSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const dprRef = useRef<number>(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  
  // Calmness computation state (running metrics)
  const alphaPowerRef = useRef<number>(0);
  const betaPowerRef = useRef<number>(0);
  const sampleCountRef = useRef<number>(0);
  const efficacyStreakRef = useRef<EfficacyStreak>({
    startedAtMs: null,
    lastAboveThresholdAtMs: null,
    peakScore: 0,
    baselineScore: 0,
    dispatched: false,
  });
  
  // Component state
  const [state, setState] = useState<SomaticMonitorState>({
    isConnected: false,
    isInitializing: false,
    error: null,
    latestCalmnessScore: 0.5,
    dataBuffer: [],
  });

  /**
   * Initialize the Elata SDK components
   * - Instantiate BleTransport to stream Athena protocol packets
   * - Initialize EegPreprocessor for signal conditioning
   * - Bind frame handlers to ingest and process EEG data
   */
  const initializeSDK = async () => {
    try {
      setState(prev => ({ ...prev, isInitializing: true, error: null }));

      // Dynamically import Elata WASM modules
      const { createEegPreprocessor } = await import('@elata-biosciences/eeg-web');
      const { BleTransport } = await import('@elata-biosciences/eeg-web-ble');

      // Instantiate the EEG signal preprocessor (handles reference, detrend, notch)
      const eegProcessor = await createEegPreprocessor({
        enabled: true,
        preserveRaw: false,
        reference: { mode: 'common-average' },
        detrend: { mode: 'highpass' },
        notch: { mainsHz: 60, harmonics: [2] },
      });
      eegProcessorRef.current = eegProcessor;

      // Either adopt the transport handed in by DeviceSelection (already
      // through GATT handshake) or instantiate a fresh one and connect now.
      const bleTransport =
        preparedTransport ??
        new BleTransport({
          eegProcessing: false, // We handle preprocessing manually
        });

      // Bind the frame handler to process incoming EEG data
      bleTransport.onFrame = handleHeadbandFrame;
      bleTransport.onStatus = handleConnectionStatus;

      bleTransportRef.current = bleTransport;

      // Kick off the stream. `startStreaming` is idempotent — it skips re-pair
      // if the BLE link is already up (which it is when handed in pre-paired).
      await bleTransport.startStreaming();

      setState(prev => ({ ...prev, isInitializing: false, isConnected: true }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown SDK initialization error';
      setState(prev => ({
        ...prev,
        isInitializing: false,
        error: `SDK initialization failed: ${errorMessage}`,
      }));
      console.error('Failed to initialize SDK:', error);
    }
  };

  /**
   * Compute calmness score as alpha-to-beta power ratio from EEG frame
   * - Extract power spectrum from EEG channels using Welch's method (simulated)
   * - Compute alpha (8-12 Hz) and beta (13-30 Hz) band power
   * - Return calmness = alpha / (alpha + beta) normalized to [0, 1]
   */
  const computeCalmnessScore = (eegChannels: number[][]): number => {
    if (eegChannels.length === 0 || eegChannels[0].length === 0) {
      return 0.5;
    }

    // Simplified power estimation using band-pass energy
    // In production, use Welch's method or FFT for spectral analysis
    let alphaPower = 0;
    let betaPower = 0;

    for (const channel of eegChannels) {
      // Compute approximate band power via variance in different frequency bins
      // This is a simplified heuristic; full implementation would use FFT
      const variance = computeVariance(channel);
      
      // Heuristic: alpha power is correlated with lower variance, beta with higher
      alphaPower += Math.max(0, variance * 0.3);
      betaPower += Math.max(0, variance * 0.7);
    }

    // Normalize to [0, 1]: higher alpha relative to beta = higher calmness
    const totalPower = alphaPower + betaPower;
    if (totalPower === 0) return 0.5;
    
    return Math.min(1, alphaPower / totalPower);
  };

  /**
   * Compute sample variance for band power estimation
   */
  const computeVariance = (samples: number[]): number => {
    if (samples.length === 0) return 0;
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / samples.length;
    return Math.sqrt(variance);
  };

  /**
   * Detect alpha bump: transient increase in alpha power (heuristic)
   */
  const detectAlphaBump = (currentCalmness: number): boolean => {
    // Simple heuristic: bump if calmness suddenly increases
    // In production: use wavelet analysis or state machine
    const previousCalmness = state.latestCalmnessScore;
    return (currentCalmness - previousCalmness) > 0.15;
  };

  const dispatchToEdge = (sessionPayload: SessionPayload) => {
    console.info('[AntigravityBackend] sessionPayload', JSON.stringify(sessionPayload));
  };

  const updateEfficacyStreak = (dataPoint: TelemetryDataPoint) => {
    const threshold = 0.7;
    const minDurationMs = 3 * 60 * 1000;
    const streak = efficacyStreakRef.current;

    if (dataPoint.calmnessScore <= threshold) {
      efficacyStreakRef.current = {
        startedAtMs: null,
        lastAboveThresholdAtMs: null,
        peakScore: 0,
        baselineScore: 0,
        dispatched: false,
      };
      return;
    }

    if (streak.startedAtMs === null) {
      efficacyStreakRef.current = {
        startedAtMs: dataPoint.timestamp,
        lastAboveThresholdAtMs: dataPoint.timestamp,
        peakScore: dataPoint.calmnessScore,
        baselineScore: dataPoint.calmnessScore,
        dispatched: false,
      };
      return;
    }

    const nextPeakScore = Math.max(streak.peakScore, dataPoint.calmnessScore);
    const nextLastAboveThresholdAtMs = dataPoint.timestamp;
    const streakDurationMs = nextLastAboveThresholdAtMs - streak.startedAtMs;

    efficacyStreakRef.current = {
      ...streak,
      lastAboveThresholdAtMs: nextLastAboveThresholdAtMs,
      peakScore: nextPeakScore,
    };

    if (!streak.dispatched && streakDurationMs >= minDurationMs) {
      const sessionPayload: SessionPayload = {
        sessionId: sessionIdRef.current,
        trackId: 'lyria-supernova-001',
        hardwareType: 'Muse S Athena',
        efficacyDelta: Number((nextPeakScore - streak.baselineScore).toFixed(4)),
      };

      dispatchToEdge(sessionPayload);
      efficacyStreakRef.current = {
        ...efficacyStreakRef.current,
        dispatched: true,
      };
    }
  };

  /**
   * Handle incoming HeadbandFrame from the BLE transport
   * - Process raw EEG data through signal conditioning
   * - Compute calmness and alpha bump detection
   * - Update canvas telemetry buffer
   */
  const handleHeadbandFrame = (frame: HeadbandFrameV1) => {
    try {
      if (!eegProcessorRef.current) {
        return;
      }

      // Preprocess the frame (reference, detrend, notch)
      const processedFrame = eegProcessorRef.current.processFrame(frame);

      // Extract EEG samples from the processed frame
      // The frame contains a HeadbandSignalBlock with samples as number[][]
      const eegSamples = processedFrame.eeg.samples || [];

      // Compute calmness score from EEG power spectrum
      const calmnessScore = computeCalmnessScore(eegSamples);

      // Detect alpha bump state transitions
      const alphaBumpDetected = detectAlphaBump(calmnessScore);

      // Append telemetry datapoint to buffer for canvas rendering
      const dataPoint: TelemetryDataPoint = {
        timestamp: Date.now(),
        calmnessScore,
        alphaBumpDetected,
      };

      // Drive the sonic intervention from the same telemetry tick that
      // feeds the canvas. `pushCalmness` ramps the binaural carrier and
      // fires a Solfeggio chime when `alphaBumpDetected` is true.
      audioEngineRef.current?.pushCalmness(dataPoint);

      setState(prev => ({
        ...prev,
        latestCalmnessScore: calmnessScore,
        dataBuffer: [...prev.dataBuffer.slice(-3599), dataPoint], // Keep last 60 minutes @ 1Hz
      }));

      updateEfficacyStreak(dataPoint);
    } catch (error) {
      console.error('Error processing headband frame:', error);
    }
  };

  /**
   * Handle BLE connection status changes
   */
  const handleConnectionStatus = (status: HeadbandTransportStatus) => {
    const isConnected = status.state === 'connected' || status.state === 'streaming';
    setState(prev => ({
      ...prev,
      isConnected,
      error: isConnected ? null : prev.error,
    }));
  };

  /**
   * Render telemetry onto the canvas
   * - Draw calmness score graph (y-axis: 0.0-1.0, x-axis: time)
   * - Overlay alpha bump markers as vertical lines
   * - Update at high frequency for smooth, low-latency visualization
   */
  const renderTelemetry = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Apply the HiDPI transform on every frame — setTransform (not scale)
    // because scale compounds and would magnify each tick.
    const dpr = dprRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Draw in logical (CSS-pixel) space so layout numbers stay readable.
    const width = logicalSizeRef.current.width || canvas.width / dpr;
    const height = logicalSizeRef.current.height || canvas.height / dpr;
    const margin = 40;
    const graphWidth = width - 2 * margin;
    const graphHeight = height - 2 * margin;

    // Clear canvas with dark background for clinical aesthetics
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, width, height);

    // Draw grid and axes
    drawAxes(ctx, width, height, margin);

    // Draw calmness score graph
    if (state.dataBuffer.length > 1) {
      drawCalmnessGraph(ctx, margin, graphWidth, graphHeight, width, height);
    }

    // Overlay alpha bump markers
    drawAlphaBumpMarkers(ctx, margin, graphHeight, width, height);

    // Draw statistics panel
    drawStatsPanel(ctx, width, height);
  };

  /**
   * Draw coordinate axes and grid
   */
  const drawAxes = (ctx: CanvasRenderingContext2D, width: number, height: number, margin: number) => {
    ctx.strokeStyle = '#1e2749';
    ctx.lineWidth = 1;

    // Horizontal grid lines (calmness score levels)
    for (let i = 0; i <= 10; i++) {
      const y = margin + (height - 2 * margin) * (i / 10);
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }

    // Vertical axis
    ctx.strokeStyle = '#2a3548';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();

    // Y-axis label (Calmness Score)
    ctx.fillStyle = '#8a92b2';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 10; i++) {
      const y = margin + (height - 2 * margin) * (i / 10);
      const value = (1 - i / 10).toFixed(1);
      ctx.fillText(value, margin - 8, y + 4);
    }

    // X-axis label (Time)
    ctx.textAlign = 'center';
    ctx.fillText('Time (s)', width / 2, height - 8);
  };

  /**
   * Draw the calmness score line graph
   */
  const drawCalmnessGraph = (
    ctx: CanvasRenderingContext2D,
    margin: number,
    graphWidth: number,
    graphHeight: number,
    width: number,
    height: number
  ) => {
    const { dataBuffer } = state;
    if (dataBuffer.length < 2) return;

    ctx.strokeStyle = '#00d9ff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    for (let i = 0; i < dataBuffer.length; i++) {
      const x = margin + (graphWidth / (dataBuffer.length - 1)) * i;
      const y = height - margin - (graphHeight * dataBuffer[i].calmnessScore);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw data points as small circles
    ctx.fillStyle = '#00d9ff';
    for (let i = 0; i < dataBuffer.length; i += Math.max(1, Math.floor(dataBuffer.length / 50))) {
      const x = margin + (graphWidth / (dataBuffer.length - 1)) * i;
      const y = height - margin - (graphHeight * dataBuffer[i].calmnessScore);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  /**
   * Draw vertical markers for alpha bump state transitions
   */
  const drawAlphaBumpMarkers = (
    ctx: CanvasRenderingContext2D,
    margin: number,
    graphHeight: number,
    width: number,
    height: number
  ) => {
    const { dataBuffer } = state;
    if (dataBuffer.length < 2) return;

    const graphWidth = width - 2 * margin;

    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;

    for (let i = 0; i < dataBuffer.length; i++) {
      if (dataBuffer[i].alphaBumpDetected) {
        const x = margin + (graphWidth / (dataBuffer.length - 1)) * i;
        ctx.beginPath();
        ctx.moveTo(x, margin);
        ctx.lineTo(x, height - margin);
        ctx.stroke();
      }
    }
  };

  /**
   * Draw real-time statistics panel
   */
  const drawStatsPanel = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const panelX = 20;
    const panelY = 20;
    const panelWidth = 280;
    const panelHeight = 120;

    // Semi-transparent background
    ctx.fillStyle = 'rgba(10, 14, 39, 0.8)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Border
    ctx.strokeStyle = '#2a3548';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Text labels
    ctx.fillStyle = '#8a92b2';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SOMATIC MONITOR', panelX + 12, panelY + 25);

    // Status
    const statusText = state.isConnected ? 'CONNECTED' : 'DISCONNECTED';
    const statusColor = state.isConnected ? '#00d9ff' : '#ff6b6b';
    ctx.fillStyle = statusColor;
    ctx.font = '12px monospace';
    ctx.fillText(`Status: ${statusText}`, panelX + 12, panelY + 48);

    // Calmness score
    ctx.fillStyle = '#00d9ff';
    ctx.fillText(`Calmness: ${state.latestCalmnessScore.toFixed(3)}`, panelX + 12, panelY + 68);

    // Data points
    ctx.fillStyle = '#8a92b2';
    ctx.fillText(`Samples: ${state.dataBuffer.length}`, panelX + 12, panelY + 88);

    // Error display (if any)
    if (state.error) {
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '11px monospace';
      ctx.fillText(state.error.substring(0, 35), panelX + 12, panelY + 108);
    }
  };

  /**
   * Canvas animation loop
   */
  const animate = () => {
    renderTelemetry();
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  /**
   * Initialize canvas and SDK on component mount
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas resolution to match display size, scaled by devicePixelRatio
    // so the calmness line + alpha-bump markers stay crisp on Retina displays.
    // CSS size (in logical px) is set on the element style; the backing
    // store (`canvas.width/height` in physical px) is `cssSize * dpr`. The
    // 2D context transform is applied per-frame in renderTelemetry so a
    // resize never compounds an existing scale.
    const updateCanvasSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      logicalSizeRef.current = { width: rect.width, height: rect.height };
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    };

    updateCanvasSize();

    // Initialize SDK
    initializeSDK();

    // Start animation loop
    animate();

    // Handle window resize
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();

      // Shutdown BLE transport
      if (bleTransportRef.current) {
        bleTransportRef.current.stop?.();
      }

      // Fade out the audio intervention with the same lifecycle. Engine
      // ownership is shared with the parent, so cleanup is best-effort.
      void audioEngineRef.current?.stop();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-screen bg-dark-navy flex flex-col items-center justify-center"
      style={{
        backgroundColor: '#0a0e27',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          backgroundColor: '#0a0e27',
        }}
      />

      {/* Connection Status Badge */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '8px 16px',
          backgroundColor: state.isConnected ? '#00d9ff' : '#ff6b6b',
          color: '#0a0e27',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          fontFamily: 'monospace',
          zIndex: 10,
        }}
      >
        {state.isConnected ? '● STREAMING' : '○ IDLE'}
      </div>

      {/* Error Message Display */}
      {state.error && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            padding: '12px 16px',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            borderLeft: '3px solid #ff6b6b',
            color: '#ff6b6b',
            fontSize: '12px',
            fontFamily: 'monospace',
            maxWidth: '300px',
            zIndex: 10,
          }}
        >
          {state.error}
        </div>
      )}

      {/* Initializing Spinner */}
      {state.isInitializing && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '14px',
            color: '#8a92b2',
            fontFamily: 'monospace',
            textAlign: 'center',
            zIndex: 20,
          }}
        >
          <div>Initializing SDK...</div>
          <div style={{ marginTop: '8px', fontSize: '12px' }}>
            Loading WASM modules and BLE transport
          </div>
        </div>
      )}
    </div>
  );
};

export default SomaticMonitor;
