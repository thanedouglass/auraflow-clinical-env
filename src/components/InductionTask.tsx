import React, { useState, useEffect, useRef, useCallback } from 'react';

interface InductionTaskProps {
  onComplete: () => void;
}

export const InductionTask: React.FC<InductionTaskProps> = ({ onComplete }) => {
  // Task state
  const [isActive, setIsActive] = useState<boolean>(false);
  const [currentDigit, setCurrentDigit] = useState<number | null>(null);
  const [commissionErrors, setCommissionErrors] = useState<number>(0);
  const [omissionErrors, setOmissionErrors] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [isShowingDigit, setIsShowingDigit] = useState<boolean>(false);

  // Pre-flight checklist state
  const [quietRoom, setQuietRoom] = useState<boolean>(false);
  const [headphones, setHeadphones] = useState<boolean>(false);
  const [notificationsMuted, setNotificationsMuted] = useState<boolean>(false);

  // Refs for managing timings and state
  const taskIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stimulusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const responseRecordedRef = useRef<boolean>(false);
  const lastDigitRef = useRef<number | null>(null);

  /**
   * Generate random digit 1-9
   */
  const getRandomDigit = useCallback((): number => {
    return Math.floor(Math.random() * 9) + 1; // 1-9
  }, []);

  /**
   * Present stimulus (number for 250ms, then fixation cross for 750ms)
   */
  const presentStimulus = useCallback(() => {
    const digit = getRandomDigit();
    setCurrentDigit(digit);
    setIsShowingDigit(true);
    lastDigitRef.current = digit;
    responseRecordedRef.current = false;

    // Hide digit after 250ms, show fixation cross
    stimulusTimerRef.current = setTimeout(() => {
      setIsShowingDigit(false);
      setCurrentDigit(null);
      // Fixation cross stays for 750ms (implicit, as we only hide the digit)
    }, 250);
  }, [getRandomDigit]);

  /**
   * Check for omission error: if space wasn't pressed on a non-3 digit
   */
  const checkOmissionError = useCallback(() => {
    if (lastDigitRef.current !== null && lastDigitRef.current !== 3 && !responseRecordedRef.current) {
      setOmissionErrors((prev) => prev + 1);
    }
  }, []);

  /**
   * Main task loop: present stimulus every 1000ms
   */
  const startTaskLoop = useCallback(() => {
    // Present first stimulus immediately
    presentStimulus();

    // Then present every 1000ms
    taskIntervalRef.current = setInterval(() => {
      checkOmissionError();
      presentStimulus();
    }, 1000);
  }, [presentStimulus, checkOmissionError]);

  /**
   * Handle spacebar press
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();

        if (!isActive || lastDigitRef.current === null || responseRecordedRef.current) {
          return;
        }

        responseRecordedRef.current = true;

        // If digit is 3, it's a commission error (false alarm)
        if (lastDigitRef.current === 3) {
          setCommissionErrors((prev) => prev + 1);
        }
        // If digit is 1,2,4,5,6,7,8,9, it's a correct go (no error increment)
      }
    },
    [isActive]
  );

  /**
   * Start the induction task
   */
  const handleBeginTask = useCallback(() => {
    setIsActive(true);
    setCommissionErrors(0);
    setOmissionErrors(0);
    setTimeLeft(180);
    setCurrentDigit(null);
    setIsShowingDigit(false);
  }, []);

  /**
   * Check if all pre-flight checklist items are complete
   */
  const allChecklistsComplete = quietRoom && headphones && notificationsMuted;

  /**
   * Effect: manage task loop when isActive changes
   */
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      startTaskLoop();
    }

    return () => {
      if (taskIntervalRef.current) {
        clearInterval(taskIntervalRef.current);
      }
      if (stimulusTimerRef.current) {
        clearTimeout(stimulusTimerRef.current);
      }
    };
  }, [isActive, timeLeft, startTaskLoop]);

  /**
   * Effect: countdown timer
   */
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setIsActive(false);
            if (taskIntervalRef.current) {
              clearInterval(taskIntervalRef.current);
            }
            if (stimulusTimerRef.current) {
              clearTimeout(stimulusTimerRef.current);
            }
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [isActive]);

  /**
   * Effect: global keydown listener
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  /**
   * Effect: cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (taskIntervalRef.current) {
        clearInterval(taskIntervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (stimulusTimerRef.current) {
        clearTimeout(stimulusTimerRef.current);
      }
    };
  }, []);

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden">
      {/* Task not started */}
      {!isActive && timeLeft === 180 && (
        <div className="text-center space-y-8 max-w-2xl">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-cyan-400">SART Task</h1>
            <p className="text-xl text-slate-300">
              A sustained attention task measuring your cognitive response time under stress.
            </p>
            <p className="text-lg text-slate-400">
              Press <span 
                style={{
                  fontFamily: 'monospace',
                  backgroundColor: 'rgba(30, 41, 59, 0.6)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  display: 'inline-block',
                }}
              >SPACE</span> when you see most numbers.
              <br />
              <span className="text-red-400 font-semibold">Do NOT press SPACE when you see 3.</span>
            </p>
          </div>

          {/* Pre-flight Checklist - Glassmorphism */}
          <div 
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(28px) saturate(140%)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              borderRadius: 20,
            }}
            className="p-8 space-y-6"
          >
            <h2 className="text-xl font-semibold text-cyan-300 text-left uppercase tracking-wider">Pre-Flight Checklist</h2>

            {/* Checkbox 1: Quiet Room */}
            <label className="flex items-center gap-4 cursor-pointer group">
              <div className="relative w-6 h-6">
                <input
                  type="checkbox"
                  checked={quietRoom}
                  onChange={(e) => setQuietRoom(e.target.checked)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div 
                  className={`absolute inset-0 rounded border transition-all ${
                    quietRoom 
                      ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)]' 
                      : 'border-slate-600 bg-slate-800/40 border-white/10'
                  }`}
                >
                  {quietRoom && (
                    <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-left text-slate-300 group-hover:text-slate-100 transition-colors font-medium">
                I am in a quiet room
              </span>
            </label>

            {/* Checkbox 2: Headphones */}
            <label className="flex items-center gap-4 cursor-pointer group">
              <div className="relative w-6 h-6">
                <input
                  type="checkbox"
                  checked={headphones}
                  onChange={(e) => setHeadphones(e.target.checked)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div 
                  className={`absolute inset-0 rounded border transition-all ${
                    headphones 
                      ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)]' 
                      : 'border-slate-600 bg-slate-800/40 border-white/10'
                  }`}
                >
                  {headphones && (
                    <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-left text-slate-300 group-hover:text-slate-100 transition-colors font-medium">
                I am wearing headphones
              </span>
            </label>

            {/* Checkbox 3: Notifications Muted */}
            <label className="flex items-center gap-4 cursor-pointer group">
              <div className="relative w-6 h-6">
                <input
                  type="checkbox"
                  checked={notificationsMuted}
                  onChange={(e) => setNotificationsMuted(e.target.checked)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div 
                  className={`absolute inset-0 rounded border transition-all ${
                    notificationsMuted 
                      ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)]' 
                      : 'border-slate-600 bg-slate-800/40 border-white/10'
                  }`}
                >
                  {notificationsMuted && (
                    <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-left text-slate-300 group-hover:text-slate-100 transition-colors font-medium">
                My device notifications are muted
              </span>
            </label>
          </div>

          {/* Begin Task Button - Matching Connect button */}
          <button
            onClick={handleBeginTask}
            disabled={!allChecklistsComplete}
            style={{
              padding: '14px 28px',
              borderRadius: 14,
              border: '1px solid rgba(148, 163, 184, 0.22)',
              background: !allChecklistsComplete
                ? 'rgba(56, 189, 248, 0.08)'
                : `linear-gradient(135deg, #38bdf8 0%, rgba(255,255,255,0.12) 200%)`,
              color: '#070a0f',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: !allChecklistsComplete ? 'not-allowed' : 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: !allChecklistsComplete ? 'none' : '0 16px 32px rgba(6, 182, 212, 0.3)',
              transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
              opacity: !allChecklistsComplete ? 0.6 : 1,
              width: '100%',
            }}
            onMouseDown={(e) => {
              if (allChecklistsComplete) {
                e.currentTarget.style.transform = 'scale(0.98)';
              }
            }}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {allChecklistsComplete ? 'Begin Task' : 'Complete Checklist to Continue'}
          </button>
        </div>
      )}

      {/* Task in progress */}
      {isActive && timeLeft > 0 && (
        <div className="w-full h-full flex flex-col items-center justify-center relative">
          {/* Stimulus area - centered, massive, glowing */}
          <div className="flex-1 flex items-center justify-center w-full">
            {isShowingDigit && currentDigit !== null ? (
              <div 
                style={{
                  fontSize: '15rem',
                  fontWeight: 300,
                  color: '#ffffff',
                  userSelect: 'none',
                  textShadow: '0 0 15px rgba(6, 182, 212, 0.5), 0 0 30px rgba(6, 182, 212, 0.3)',
                  letterSpacing: '-0.02em',
                }}
              >
                {currentDigit}
              </div>
            ) : (
              <div 
                style={{
                  fontSize: '13rem',
                  fontWeight: 300,
                  color: 'rgba(71, 85, 105, 0.6)',
                  userSelect: 'none',
                  textShadow: '0 0 8px rgba(6, 182, 212, 0.2)',
                  letterSpacing: '0.1em',
                }}
              >
                +
              </div>
            )}
          </div>

          {/* Metrics panel - Premium typography */}
          <div className="absolute top-8 left-8 space-y-4">
            <div className="text-cyan-400 uppercase tracking-widest text-xs font-bold">
              Time: <span className="text-white font-mono ml-2">{formatTime(timeLeft)}</span>
            </div>
            <div className="text-amber-400 uppercase tracking-widest text-xs font-bold">
              False Alarms: <span className="text-white font-mono ml-2">{commissionErrors}</span>
            </div>
            <div className="text-red-400 uppercase tracking-widest text-xs font-bold">
              Misses: <span className="text-white font-mono ml-2">{omissionErrors}</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="absolute bottom-8 text-center text-sm text-slate-400">
            Press SPACE to respond · Watch the screen · Stay focused
          </div>
        </div>
      )}

      {/* Task complete */}
      {!isActive && timeLeft === 0 && (
        <div className="text-center space-y-8 max-w-2xl">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-green-400">Task Complete</h1>
            <p className="text-lg text-slate-300">
              You've completed the sustained attention task. Here are your results:
            </p>
          </div>

          {/* Results grid */}
          <div className="grid grid-cols-2 gap-6 bg-slate-900 p-8 rounded-lg border border-slate-700">
            <div className="space-y-2">
              <p className="text-sm text-slate-400 uppercase tracking-wider">False Alarms</p>
              <p className="text-5xl font-bold text-amber-400">{commissionErrors}</p>
              <p className="text-xs text-slate-500">Presses on 3 (incorrect)</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-400 uppercase tracking-wider">Misses</p>
              <p className="text-5xl font-bold text-red-400">{omissionErrors}</p>
              <p className="text-xs text-slate-500">Non-3s without response</p>
            </div>
          </div>

          {/* Analysis text */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-700 space-y-2 text-left">
            <p className="text-slate-300">
              <span className="text-slate-400">Total Errors:</span>{' '}
              <span className="font-bold text-cyan-400">{commissionErrors + omissionErrors}</span>
            </p>
            <p className="text-sm text-slate-400 italic">
              This measure reflects your capacity to maintain sustained attention under cognitive load.
            </p>
          </div>

          <button
            onClick={onComplete}
            className="w-full px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-lg transition-colors"
          >
            Proceed to Recovery
          </button>
        </div>
      )}
    </div>
  );
};
