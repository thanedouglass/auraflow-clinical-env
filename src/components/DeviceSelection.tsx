import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Environment, Float, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { BleTransport } from '@elata-biosciences/eeg-web-ble';
import { HeadlessAudioEngine } from '../utils/HeadlessAudioEngine';

/**
 * Three Muse headband variants the operator can select before connect.
 * `modelUrl` points at an optional .glb placeholder dropped under /public.
 * If the asset 404s the carousel falls back to procedural geometry so the
 * scene still renders in dev without binary assets checked in.
 */
export interface MuseDeviceOption {
  id: 'muse-2' | 'muse-s' | 'muse-s-athena';
  name: string;
  tagline: string;
  modelUrl: string;
  // Web Bluetooth `namePrefix` filter — Athena hardware advertises as "MuseS"
  // with a distinct firmware suffix; here it's used to label the picker hint.
  blePrefix: string;
  accent: string;
  fallback: 'cylinder' | 'rounded' | 'curved';
}

const DEVICES: MuseDeviceOption[] = [
  {
    id: 'muse-2',
    name: 'Muse 2',
    tagline: '4-channel EEG · PPG · IMU',
    modelUrl: '/models/muse_2.glb',
    blePrefix: 'Muse-',
    accent: '#38bdf8',
    fallback: 'cylinder',
  },
  {
    id: 'muse-s',
    name: 'Muse S',
    tagline: 'Soft-band EEG · sleep optimized',
    modelUrl: '/models/muse_s.glb',
    blePrefix: 'MuseS',
    accent: '#a78bfa',
    fallback: 'rounded',
  },
  {
    id: 'muse-s-athena',
    name: 'Muse S (Athena)',
    tagline: 'fNIRS · Athena protocol · clinical',
    modelUrl: '/models/muse_athena.glb',
    blePrefix: 'MuseS',
    accent: '#34d399',
    fallback: 'curved',
  },
];

const RADIUS = 2.6;

interface DeviceSelectionProps {
  onConnected: (payload: {
    transport: BleTransport;
    device: MuseDeviceOption;
    audioEngine: HeadlessAudioEngine;
  }) => void;
}

type ConnectionStatus = 'idle' | 'pairing' | 'handshaking' | 'streaming' | 'error';

export const DeviceSelection: React.FC<DeviceSelectionProps> = ({ onConnected }) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(1); // start on Muse S
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // `isConnecting` covers the entire async window from Connect-click until
  // either onConnected fires or pairing fails. It drives the breathing
  // opacity pulse on the glass panel and the button copy override.
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const focusedDevice = DEVICES[focusedIndex];

  const handleSwipe = (direction: -1 | 1) => {
    setFocusedIndex((prev) => (prev + direction + DEVICES.length) % DEVICES.length);
  };

  const handleConnect = async () => {
    if (status === 'pairing' || status === 'handshaking') return;
    setErrorMessage(null);
    setStatus('pairing');
    setIsConnecting(true);

    // Construct + unlock the AudioContext synchronously inside the click
    // gesture. Any `await` before `start()` would break the browser's
    // gesture-association heuristic and Safari would refuse to play.
    const audioEngine = new HeadlessAudioEngine();
    const audioReady = audioEngine.start().catch((err) => {
      console.warn('Audio engine unlock failed; continuing without sound.', err);
    });

    try {
      if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
        throw new Error('Web Bluetooth unavailable in this browser.');
      }

      const { BleTransport } = await import('@elata-biosciences/eeg-web-ble');
      // `sourceName` tags emitted frames with the variant the operator selected
      // in the carousel. The Web Bluetooth chooser still presents the system
      // picker — the prefix is shown in the UI so the operator knows which
      // device to pick.
      const transport = new BleTransport({
        sourceName: focusedDevice.name,
        eegProcessing: false,
      });

      transport.onStatus = (s) => {
        if (s.state === 'connected') setStatus('handshaking');
        if (s.state === 'streaming') setStatus('streaming');
      };

      // `connect()` performs the BLE handshake (pair + GATT service discovery
      // + characteristic subscription) without yet starting the stream.
      await transport.connect();
      setStatus('handshaking');

      // Make sure the audio context is fully resumed before handing off; if
      // the unlock failed earlier the engine simply runs silent.
      await audioReady;

      // Hand off the live transport + audio engine to the parent —
      // SomaticMonitor will attach `onFrame`, drive the engine, and call
      // `startStreaming()`.
      onConnected({ transport, device: focusedDevice, audioEngine });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown BLE error';
      setErrorMessage(msg);
      setStatus('error');
      // If pairing failed we don't need the audio graph either.
      void audioEngine.stop();
      // Release the pulse + button lock so the operator can retry.
      setIsConnecting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background:
          'radial-gradient(ellipse 100% 70% at 50% -10%, rgba(56, 189, 248, 0.18), transparent 60%),' +
          'radial-gradient(ellipse 80% 60% at 90% 100%, rgba(167, 139, 250, 0.12), transparent 60%),' +
          'linear-gradient(180deg, #070a0f 0%, #0c1118 100%)',
        overflow: 'hidden',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: '#f1f5f9',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(56, 189, 248, 0.08) 0, transparent 40%)," +
            "radial-gradient(circle at 80% 70%, rgba(52, 211, 153, 0.06) 0, transparent 40%)",
          pointerEvents: 'none',
        }}
      />

      {/* Breathing-pulse keyframe — local to this component so we don't
          have to touch the global stylesheet. Mirrors Tailwind's
          animate-pulse but with a slower, more "exhale" feel. */}
      <style>{`
        @keyframes ds-breathing-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(960px, 92vw)',
          height: 'min(640px, 88vh)',
          borderRadius: 28,
          background: 'rgba(18, 26, 38, 0.42)',
          backdropFilter: 'blur(28px) saturate(140%)',
          WebkitBackdropFilter: 'blur(28px) saturate(140%)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          boxShadow:
            '0 32px 80px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          overflow: 'hidden',
          animation: isConnecting ? 'ds-breathing-pulse 2.4s ease-in-out infinite' : 'none',
        }}
      >
        <header
          style={{
            padding: '22px 28px 12px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#94a3b8',
              }}
            >
              AuraFlow · Hardware Bring-up
            </p>
            <h1
              style={{
                margin: '4px 0 0',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              Select your headband
            </h1>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid rgba(148, 163, 184, 0.18)',
              background: 'rgba(7, 10, 15, 0.45)',
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              color: '#94a3b8',
            }}
          >
            {focusedIndex + 1} / {DEVICES.length}
          </div>
        </header>

        <div style={{ position: 'relative' }}>
          <Canvas
            camera={{ position: [0, 0.4, 6], fov: 38 }}
            dpr={[1, 2]}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <ambientLight intensity={0.55} />
              <directionalLight position={[3, 5, 4]} intensity={1.1} color="#cfeaff" />
              <directionalLight position={[-4, -2, -2]} intensity={0.4} color={focusedDevice.accent} />
              <Environment preset="city" />
              <Carousel focusedIndex={focusedIndex} onPick={setFocusedIndex} />
            </Suspense>
          </Canvas>

          <CarouselControls
            onPrev={() => handleSwipe(-1)}
            onNext={() => handleSwipe(1)}
          />
        </div>

        <footer
          style={{
            padding: '20px 28px 24px',
            borderTop: '1px solid rgba(148, 163, 184, 0.08)',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 24,
            alignItems: 'center',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                background: `linear-gradient(135deg, #ffffff 0%, ${focusedDevice.accent} 120%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {focusedDevice.name}
            </h2>
            <p style={{ margin: '4px 0 8px', color: '#94a3b8', fontSize: 14 }}>
              {focusedDevice.tagline}
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px',
                borderRadius: 8,
                background: 'rgba(7, 10, 15, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.12)',
                fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
                fontSize: 11,
                color: '#cbd5e1',
              }}
            >
              <StatusDot status={status} />
              <span>{describeStatus(status, focusedDevice.blePrefix)}</span>
            </div>
            {errorMessage && (
              <p
                style={{
                  margin: '10px 0 0',
                  color: '#fca5a5',
                  fontSize: 12,
                  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
                }}
              >
                {errorMessage}
              </p>
            )}
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            style={{
              padding: '14px 28px',
              borderRadius: 14,
              border: '1px solid rgba(148, 163, 184, 0.22)',
              background: isConnecting
                ? 'rgba(56, 189, 248, 0.18)'
                : `linear-gradient(135deg, ${focusedDevice.accent} 0%, rgba(255,255,255,0.12) 200%)`,
              backgroundColor: 'rgba(56, 189, 248, 0.18)',
              color: '#070a0f',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: isConnecting ? 'progress' : 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: `0 16px 32px ${focusedDevice.accent}30`,
              transition: 'transform 120ms ease, box-shadow 120ms ease',
              opacity: isConnecting ? 0.85 : 1,
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {isConnecting
              ? 'Aligning Frequencies…'
              : status === 'streaming'
              ? 'Connected'
              : 'Connect'}
          </button>
        </footer>
      </div>
    </div>
  );
};

/* ───────────────────────── 3D scene ───────────────────────── */

interface CarouselProps {
  focusedIndex: number;
  onPick: (i: number) => void;
}

const Carousel: React.FC<CarouselProps> = ({ focusedIndex, onPick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const targetRotation = useRef(0);

  // Drag-to-swipe support: track pointer X delta and snap to the nearest slot.
  const dragState = useRef<{ active: boolean; startX: number; startRot: number }>({
    active: false,
    startX: 0,
    startRot: 0,
  });

  useEffect(() => {
    targetRotation.current = -(focusedIndex * ((Math.PI * 2) / DEVICES.length));
  }, [focusedIndex]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (!dragState.current.active) {
      // Ease toward the snap angle.
      const current = groupRef.current.rotation.y;
      const next = THREE.MathUtils.damp(current, targetRotation.current, 6, delta);
      groupRef.current.rotation.y = next;
    }
  });

  return (
    <group
      ref={groupRef}
      onPointerDown={(e) => {
        dragState.current = {
          active: true,
          startX: e.clientX,
          startRot: groupRef.current?.rotation.y ?? 0,
        };
        (e.target as Element)?.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragState.current.active || !groupRef.current) return;
        const dx = e.clientX - dragState.current.startX;
        groupRef.current.rotation.y = dragState.current.startRot + dx * 0.005;
      }}
      onPointerUp={(e) => {
        if (!dragState.current.active || !groupRef.current) return;
        dragState.current.active = false;
        (e.target as Element)?.releasePointerCapture?.(e.pointerId);
        const slot = (Math.PI * 2) / DEVICES.length;
        const raw = groupRef.current.rotation.y;
        const nearestIndex =
          ((Math.round(-raw / slot) % DEVICES.length) + DEVICES.length) % DEVICES.length;
        onPick(nearestIndex);
      }}
    >
      {DEVICES.map((device, i) => {
        const angle = (i * Math.PI * 2) / DEVICES.length;
        const x = Math.sin(angle) * RADIUS;
        const z = Math.cos(angle) * RADIUS - RADIUS; // pull focused slot toward camera
        return (
          <DeviceModel
            key={device.id}
            device={device}
            position={[x, 0, z]}
            isFocused={i === focusedIndex}
            onClick={() => onPick(i)}
          />
        );
      })}
    </group>
  );
};

interface DeviceModelProps {
  device: MuseDeviceOption;
  position: [number, number, number];
  isFocused: boolean;
  onClick: () => void;
}

const DeviceModel: React.FC<DeviceModelProps> = ({ device, position, isFocused, onClick }) => {
  // Try the GLB; if it fails, useGLTF will throw and the ErrorBoundary
  // catches it so the procedural fallback renders.
  return (
    <group position={position}>
      <Float
        floatIntensity={isFocused ? 0.6 : 0.2}
        rotationIntensity={isFocused ? 0.3 : 0.1}
        speed={isFocused ? 1.6 : 0.8}
      >
        <GltfOrFallback device={device} isFocused={isFocused} onClick={onClick} />
      </Float>
    </group>
  );
};

const GltfOrFallback: React.FC<{
  device: MuseDeviceOption;
  isFocused: boolean;
  onClick: () => void;
}> = ({ device, isFocused, onClick }) => {
  return (
    <ModelErrorBoundary fallback={<ProceduralDevice device={device} isFocused={isFocused} onClick={onClick} />}>
      <Suspense fallback={<ProceduralDevice device={device} isFocused={isFocused} onClick={onClick} />}>
        <GltfDevice device={device} isFocused={isFocused} onClick={onClick} />
      </Suspense>
    </ModelErrorBoundary>
  );
};

const GltfDevice: React.FC<{
  device: MuseDeviceOption;
  isFocused: boolean;
  onClick: () => void;
}> = ({ device, isFocused, onClick }) => {
  const gltf = useGLTF(device.modelUrl);
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current && isFocused) {
      ref.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group ref={ref} onClick={onClick} dispose={null}>
      <primitive object={gltf.scene.clone()} scale={isFocused ? 1.15 : 0.85} />
    </group>
  );
};

const ProceduralDevice: React.FC<{
  device: MuseDeviceOption;
  isFocused: boolean;
  onClick: () => void;
}> = ({ device, isFocused, onClick }) => {
  const ref = useRef<THREE.Group>(null);

  // Slow auto-rotation for the focused slot, per the task spec.
  useFrame((_, delta) => {
    if (ref.current && isFocused) {
      ref.current.rotation.y += delta * 0.35;
    }
  });

  const scale = isFocused ? 1.15 : 0.85;

  const geometry = useMemo(() => {
    switch (device.fallback) {
      case 'cylinder':
        // Muse 2: rigid headband — torus segment + sensor pads
        return (
          <group>
            <mesh>
              <torusGeometry args={[0.85, 0.09, 24, 80, Math.PI * 1.2]} />
              <meshStandardMaterial
                color={device.accent}
                metalness={0.6}
                roughness={0.25}
                emissive={device.accent}
                emissiveIntensity={isFocused ? 0.35 : 0.12}
              />
            </mesh>
            {[-0.65, -0.2, 0.2, 0.65].map((x) => (
              <mesh key={x} position={[x, -0.55, 0.1]}>
                <boxGeometry args={[0.16, 0.08, 0.08]} />
                <meshStandardMaterial color="#0c1118" metalness={0.4} roughness={0.4} />
              </mesh>
            ))}
          </group>
        );
      case 'rounded':
        // Muse S: soft headband — wide ribbon
        return (
          <group>
            <mesh>
              <torusGeometry args={[0.9, 0.14, 24, 80, Math.PI * 1.5]} />
              <meshStandardMaterial
                color={device.accent}
                metalness={0.2}
                roughness={0.6}
                emissive={device.accent}
                emissiveIntensity={isFocused ? 0.28 : 0.08}
              />
            </mesh>
            <mesh position={[0, 0.92, 0]}>
              <sphereGeometry args={[0.18, 24, 16]} />
              <meshStandardMaterial color={device.accent} metalness={0.5} roughness={0.3} />
            </mesh>
          </group>
        );
      case 'curved':
      default:
        // Muse S Athena: curved headband + clinical fNIRS pucks
        return (
          <group>
            <mesh>
              <torusGeometry args={[0.95, 0.12, 24, 80, Math.PI * 1.4]} />
              <meshPhysicalMaterial
                color={device.accent}
                metalness={0.4}
                roughness={0.25}
                clearcoat={0.8}
                clearcoatRoughness={0.15}
                emissive={device.accent}
                emissiveIntensity={isFocused ? 0.4 : 0.12}
              />
            </mesh>
            {[-0.55, 0, 0.55].map((x, idx) => (
              <mesh key={idx} position={[x, 0.85, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
                <meshStandardMaterial color="#f1f5f9" metalness={0.7} roughness={0.2} />
              </mesh>
            ))}
            <mesh position={[0, -0.4, 0]}>
              <sphereGeometry args={[0.08, 16, 12]} />
              <meshStandardMaterial
                color="#34d399"
                emissive="#34d399"
                emissiveIntensity={isFocused ? 1.5 : 0.4}
              />
            </mesh>
          </group>
        );
    }
  }, [device, isFocused]);

  return (
    <group ref={ref} scale={scale} onClick={onClick}>
      {geometry}
      {isFocused && (
        <Html position={[0, -1.3, 0]} center distanceFactor={6}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: device.accent,
              textShadow: `0 0 12px ${device.accent}`,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            ◆ Focused
          </div>
        </Html>
      )}
    </group>
  );
};

class ModelErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    // GLB missing in dev is expected; fall back silently.
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/* ───────────────────────── chrome ───────────────────────── */

const CarouselControls: React.FC<{ onPrev: () => void; onNext: () => void }> = ({
  onPrev,
  onNext,
}) => {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 44,
    height: 44,
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(18, 26, 38, 0.55)',
    backdropFilter: 'blur(12px)',
    color: '#f1f5f9',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <>
      <button
        onClick={onPrev}
        style={{ ...baseStyle, left: 20 }}
        aria-label="Previous device"
      >
        ‹
      </button>
      <button
        onClick={onNext}
        style={{ ...baseStyle, right: 20 }}
        aria-label="Next device"
      >
        ›
      </button>
    </>
  );
};

const StatusDot: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const color =
    status === 'streaming'
      ? '#34d399'
      : status === 'error'
      ? '#f87171'
      : status === 'pairing' || status === 'handshaking'
      ? '#fbbf24'
      : '#64748b';
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 8px ${color}`,
        flexShrink: 0,
      }}
    />
  );
};

function describeStatus(status: ConnectionStatus, prefix: string): string {
  switch (status) {
    case 'idle':
      return `Ready · pick "${prefix}…" in the browser dialog`;
    case 'pairing':
      return 'Requesting BLE device…';
    case 'handshaking':
      return 'GATT handshake in progress…';
    case 'streaming':
      return 'Streaming — routing to Somatic Monitor';
    case 'error':
      return 'Connection failed';
  }
}

// Preload hint for drei's loader; safe even if asset is missing — useGLTF
// throws on load failure and the ErrorBoundary handles it.
DEVICES.forEach((d) => {
  try {
    useGLTF.preload(d.modelUrl);
  } catch {
    // ignore — fallback geometry renders instead
  }
});

export default DeviceSelection;
