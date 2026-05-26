import { useState } from 'react';
import SomaticMonitor from './components/SomaticMonitor';
import RppgApp from './components/RppgApp';

export default function App() {
  const [viewMode, setViewMode] = useState<'somatic' | 'rppg'>('somatic');

  return (
    <>
      {/* View mode selector */}
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
          onClick={() => setViewMode('somatic')}
          style={{
            padding: '6px 12px',
            backgroundColor: viewMode === 'somatic' ? '#00d9ff' : '#2a3548',
            color: viewMode === 'somatic' ? '#0a0e27' : '#8a92b2',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
          }}
        >
          SOMATIC
        </button>
        <button
          onClick={() => setViewMode('rppg')}
          style={{
            padding: '6px 12px',
            backgroundColor: viewMode === 'rppg' ? '#00d9ff' : '#2a3548',
            color: viewMode === 'rppg' ? '#0a0e27' : '#8a92b2',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
          }}
        >
          rPPG
        </button>
      </div>

      {viewMode === 'somatic' ? <SomaticMonitor /> : <RppgApp />}
    </>
  );
}
