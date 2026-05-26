import { useState } from 'react';
import type { BleTransport } from '@elata-biosciences/eeg-web-ble';
import SomaticMonitor from './components/SomaticMonitor';
import RppgApp from './components/RppgApp';
import DeviceSelection, { type MuseDeviceOption } from './components/DeviceSelection';

type ViewMode = 'device-selection' | 'somatic' | 'rppg';

interface ConnectedDevice {
  transport: BleTransport;
  device: MuseDeviceOption;
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('device-selection');
  const [connected, setConnected] = useState<ConnectedDevice | null>(null);

  const handleConnected = (payload: ConnectedDevice) => {
    setConnected(payload);
    setViewMode('somatic');
  };

  return (
    <>
      {/* View mode selector — hidden until the user has paired a device, so
          the clinical bring-up flow stays uncluttered on first run. */}
      {viewMode !== 'device-selection' && (
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

      {viewMode === 'device-selection' && <DeviceSelection onConnected={handleConnected} />}
      {viewMode === 'somatic' && (
        <SomaticMonitor
          preparedTransport={connected?.transport}
          deviceLabel={connected?.device.name}
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
