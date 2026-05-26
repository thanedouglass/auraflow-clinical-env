import { useState } from 'react';
import type { BleTransport } from '@elata-biosciences/eeg-web-ble';
import SomaticMonitor from './components/SomaticMonitor';
import RppgApp from './components/RppgApp';
import DeviceSelection, { type MuseDeviceOption } from './components/DeviceSelection';
import PsychometricIntake from './components/PsychometricIntake';
import type { PsychometricScores } from './data/psychometricItems';
import type { HeadlessAudioEngine } from './utils/HeadlessAudioEngine';

type ViewMode = 'intake' | 'device-selection' | 'somatic' | 'rppg';

interface ConnectedDevice {
  transport: BleTransport;
  device: MuseDeviceOption;
  audioEngine: HeadlessAudioEngine;
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('intake');
  const [connected, setConnected] = useState<ConnectedDevice | null>(null);
  const [baselineScores, setBaselineScores] = useState<PsychometricScores | null>(null);

  const handleIntakeComplete = (scores: PsychometricScores) => {
    // Scoring happens silently in the background — we just stash the result
    // for downstream consumers and move the operator forward to hardware
    // pairing without an interstitial debrief.
    setBaselineScores(scores);
    setViewMode('device-selection');
  };

  const handleConnected = (payload: ConnectedDevice) => {
    setConnected(payload);
    setViewMode('somatic');
  };

  return (
    <>
      {/* View mode selector — hidden until the operator has paired a device,
          so the intake + bring-up flow stay uncluttered on first run. */}
      {viewMode !== 'intake' && viewMode !== 'device-selection' && (
        <div
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            zIndex: 1000,
            display: 'flex',
            gap: '8px',
            backgroundColor: 'rgba(10, 14, 39, 0.9)',
            padding: '8px',
            borderRadius: '4px',
          }}
        >
          <button
            onClick={() => setViewMode('device-selection')}
            style={tabStyle(false)}
            aria-label="Back to device selection"
          >
            DEVICES
          </button>
          <button onClick={() => setViewMode('somatic')} style={tabStyle(viewMode === 'somatic')}>
            SOMATIC
          </button>
          <button onClick={() => setViewMode('rppg')} style={tabStyle(viewMode === 'rppg')}>
            rPPG
          </button>
        </div>
      )}

      {viewMode === 'intake' && <PsychometricIntake onComplete={handleIntakeComplete} />}
      {viewMode === 'device-selection' && <DeviceSelection onConnected={handleConnected} />}
      {viewMode === 'somatic' && (
        <SomaticMonitor
          preparedTransport={connected?.transport}
          deviceLabel={connected?.device.name}
          audioEngine={connected?.audioEngine}
          baselineScores={baselineScores ?? undefined}
        />
      )}
      {viewMode === 'rppg' && <RppgApp />}
    </>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    backgroundColor: active ? '#00d9ff' : '#2a3548',
    color: active ? '#0a0e27' : '#8a92b2',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  };
}
