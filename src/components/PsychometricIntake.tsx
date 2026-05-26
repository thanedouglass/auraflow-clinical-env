import React, { useMemo, useState } from 'react';
import {
  DERS_OPTIONS,
  ERQ_OPTIONS,
  PSYCHOMETRIC_ITEMS,
  scoreResponses,
  type PsychometricItem,
  type PsychometricScores,
} from '../data/psychometricItems';

/**
 * PsychometricIntake
 *
 * Baseline ERQ + DERS capture before the operator pairs hardware. UX brief:
 *  - one question at a time, fills the viewport,
 *  - large tappable glass option buttons (no radio dots, no Likert grid),
 *  - tap auto-advances and slides to the next question,
 *  - Instagram-style segmented progress bar across the top,
 *  - scoring happens silently after the last tap; we just call onComplete.
 *
 * The UI must not feel clinical, so the underlying numeric weighting
 * (especially the reverse-scored DERS items) is never shown — only the
 * canonical scale labels from the spec.
 */

interface PsychometricIntakeProps {
  onComplete: (scores: PsychometricScores) => void;
}

type Direction = 'forward' | 'backward';

export const PsychometricIntake: React.FC<PsychometricIntakeProps> = ({ onComplete }) => {
  const items = PSYCHOMETRIC_ITEMS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [direction, setDirection] = useState<Direction>('forward');
  // Re-mount key on the slide so the CSS keyframe replays for each new card.
  const [slideKey, setSlideKey] = useState(0);

  const item = items[currentIndex];
  const totalItems = items.length;
  const isErq = item.instrument === 'ERQ';
  const options = isErq ? ERQ_OPTIONS : DERS_OPTIONS;

  const accent = useMemo(() => (isErq ? '#a78bfa' : '#34d399'), [isErq]);

  const handleSelect = (optionIndex: number) => {
    const next = { ...responses, [item.id]: optionIndex };
    setResponses(next);

    if (currentIndex < totalItems - 1) {
      setDirection('forward');
      setSlideKey((k) => k + 1);
      setCurrentIndex(currentIndex + 1);
    } else {
      // Final answer — score silently and hand off.
      const scores = scoreResponses(next, items);
      onComplete(scores);
    }
  };

  const handleBack = () => {
    if (currentIndex === 0) return;
    setDirection('backward');
    setSlideKey((k) => k + 1);
    setCurrentIndex(currentIndex - 1);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: '#f1f5f9',
        background:
          'radial-gradient(ellipse 100% 70% at 50% -10%, rgba(167, 139, 250, 0.20), transparent 60%),' +
          'radial-gradient(ellipse 80% 60% at 80% 110%, rgba(52, 211, 153, 0.14), transparent 60%),' +
          'linear-gradient(180deg, #070a0f 0%, #0c1118 100%)',
      }}
    >
      <SlideKeyframes />

      <ProgressBar count={totalItems} currentIndex={currentIndex} accent={accent} />

      <header
        style={{
          position: 'absolute',
          top: 28,
          left: 0,
          right: 0,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          onClick={handleBack}
          disabled={currentIndex === 0}
          aria-label="Previous question"
          style={{
            ...glassChip,
            opacity: currentIndex === 0 ? 0.35 : 1,
            cursor: currentIndex === 0 ? 'default' : 'pointer',
          }}
        >
          ‹ Back
        </button>
        <span
          style={{
            ...glassChip,
            fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: accent,
            cursor: 'default',
          }}
        >
          {item.instrument} · {currentIndex + 1}/{totalItems}
        </span>
      </header>

      <main
        style={{
          position: 'absolute',
          inset: 0,
          padding: '110px 24px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          key={slideKey}
          style={{
            width: 'min(560px, 92vw)',
            animation:
              direction === 'forward'
                ? 'pi-slide-in-right 380ms cubic-bezier(0.22, 1, 0.36, 1)'
                : 'pi-slide-in-left 380ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <PromptCard item={item} accent={accent} indexOfInstrument={instrumentIndex(items, currentIndex)} />

          <div
            style={{
              marginTop: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {options.map((opt, idx) => {
              const isSelected = responses[item.id] === idx;
              const isErqOpt = isErq && 'value' in opt;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  style={{
                    ...glassOption(accent, isSelected),
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.985)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span
                    style={{
                      fontSize: isErqOpt ? 22 : 16,
                      fontWeight: 600,
                      letterSpacing: isErqOpt ? '-0.01em' : 0,
                    }}
                  >
                    {isErqOpt ? (opt as { label: string }).label : (opt as { label: string }).label}
                  </span>
                  {isErqOpt && (opt as { hint?: string }).hint && (
                    <span
                      style={{
                        fontSize: 12,
                        color: '#94a3b8',
                        fontWeight: 500,
                        marginLeft: 14,
                      }}
                    >
                      {(opt as { hint?: string }).hint}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

const PromptCard: React.FC<{
  item: PsychometricItem;
  accent: string;
  indexOfInstrument: number;
}> = ({ item, accent, indexOfInstrument }) => {
  return (
    <div
      style={{
        padding: '28px 26px',
        borderRadius: 24,
        background: 'rgba(18, 26, 38, 0.45)',
        backdropFilter: 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        boxShadow:
          '0 32px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#94a3b8',
        }}
      >
        Question {indexOfInstrument} · {item.instrument === 'ERQ' ? 'Emotion regulation' : 'Daily regulation'}
      </p>
      <p
        style={{
          margin: '14px 0 0',
          fontSize: 22,
          lineHeight: 1.35,
          fontWeight: 500,
          background: `linear-gradient(180deg, #ffffff 0%, ${accent}80 200%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {item.prompt}
      </p>
    </div>
  );
};

const ProgressBar: React.FC<{ count: number; currentIndex: number; accent: string }> = ({
  count,
  currentIndex,
  accent,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        display: 'flex',
        gap: 4,
        zIndex: 5,
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const filled = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              background: 'rgba(148, 163, 184, 0.22)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: filled || active ? accent : 'transparent',
                width: filled ? '100%' : active ? '40%' : '0%',
                transition: 'width 320ms ease',
                opacity: filled ? 1 : active ? 0.85 : 0,
                boxShadow: active ? `0 0 12px ${accent}80` : 'none',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

const glassChip: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background: 'rgba(18, 26, 38, 0.42)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  color: '#cbd5e1',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '0.04em',
};

function glassOption(accent: string, selected: boolean): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 60,
    padding: '16px 22px',
    borderRadius: 18,
    border: `1px solid ${selected ? accent : 'rgba(148, 163, 184, 0.18)'}`,
    background: selected
      ? `linear-gradient(135deg, ${accent}24 0%, rgba(18,26,38,0.55) 80%)`
      : 'rgba(18, 26, 38, 0.42)',
    backdropFilter: 'blur(22px) saturate(140%)',
    WebkitBackdropFilter: 'blur(22px) saturate(140%)',
    color: '#f1f5f9',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'transform 120ms ease, background 160ms ease, border-color 160ms ease',
    boxShadow: selected
      ? `0 12px 32px ${accent}30, inset 0 1px 0 rgba(255,255,255,0.08)`
      : '0 12px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
  };
}

function instrumentIndex(items: PsychometricItem[], current: number): number {
  const instrument = items[current].instrument;
  let count = 0;
  for (let i = 0; i <= current; i += 1) {
    if (items[i].instrument === instrument) count += 1;
  }
  return count;
}

// Inline <style> so we don't need to touch the global stylesheet for the
// slide animation that only this component uses.
const SlideKeyframes: React.FC = () => (
  <style>{`
    @keyframes pi-slide-in-right {
      from { opacity: 0; transform: translateX(28px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes pi-slide-in-left {
      from { opacity: 0; transform: translateX(-28px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `}</style>
);

export default PsychometricIntake;
