import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DisplayContext } from '../context/displayStore';
import { useSettings } from '../hooks/useSettings';
import { displayOff, displayOn } from '../lib/displayApi';

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];

/**
 * Idle sleep + ambient dimming.
 *
 * Children stay mounted at all times and sleep renders as an overlay on top.
 * The previous version returned a bare <div> instead of `children`, which
 * unmounted the entire dashboard — that made the `wakeFromSleep` listeners in
 * every module dead code, and meant each wake showed loading spinners and a
 * layout flash while everything remounted and refetched.
 */
const SleepMode = ({ children }) => {
  const { settings } = useSettings();
  const [isAsleep, setIsAsleep] = useState(false);
  // True from the tap that wakes the panel until that tap's click has fired.
  const [shielding, setShielding] = useState(false);
  const timerRef = useRef(null);
  const shieldTimerRef = useRef(null);

  const idleMs = Math.max(0, Number(settings.idleSleepMinutes) || 0) * 60_000;

  const sleep = useCallback(() => {
    setIsAsleep((asleep) => {
      if (!asleep) displayOff();
      return true;
    });
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const wake = useCallback(() => {
    setIsAsleep((asleep) => {
      if (asleep) displayOn();
      return false;
    });
  }, []);

  // The wake tap starts on the black overlay, but the click for that same tap
  // fires a moment later. If the overlay is gone by then, Chromium delivers
  // the click to whatever sits under the finger — the train card's Pause
  // button, the settings gear, Refresh — so tapping a dark panel to wake it
  // could silently pause arrivals. Keep a transparent copy of the overlay up
  // until the tap finishes so it swallows that click.
  const endShield = useCallback(() => {
    clearTimeout(shieldTimerRef.current);
    setShielding(false);
  }, []);

  const onOverlayPointerDown = useCallback(() => {
    if (!isAsleep) return;
    setShielding(true);
    clearTimeout(shieldTimerRef.current);
    // Safety net in case the click never arrives (a drag, a lost pointer).
    shieldTimerRef.current = setTimeout(() => setShielding(false), 1000);
    wake();
  }, [isAsleep, wake]);

  useEffect(() => () => clearTimeout(shieldTimerRef.current), []);

  // Idle countdown. Rearmed by any activity, and by waking.
  useEffect(() => {
    if (idleMs === 0 || isAsleep) return undefined;

    const arm = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(sleep, idleMs);
    };

    arm();
    ACTIVITY_EVENTS.forEach((e) =>
      document.addEventListener(e, arm, { passive: true, capture: true })
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((e) =>
        document.removeEventListener(e, arm, { capture: true })
      );
    };
  }, [idleMs, isAsleep, sleep]);

  // Ensure the panel is lit on first load.
  useEffect(() => {
    displayOn();
  }, []);

  // Allow other components (Settings "Sleep" button) to trigger sleep.
  useEffect(() => {
    const onSleep = () => sleep();
    window.addEventListener('enterSleepMode', onSleep);
    return () => window.removeEventListener('enterSleepMode', onSleep);
  }, [sleep]);

  const value = useMemo(() => ({ isAsleep, sleep, wake }), [isAsleep, sleep, wake]);

  return (
    <DisplayContext.Provider value={value}>
      {children}

      {(isAsleep || shielding) && (
        <button
          type="button"
          onPointerDown={onOverlayPointerDown}
          onClick={endShield}
          onPointerCancel={endShield}
          className={`fixed inset-0 z-[100] h-full w-full cursor-pointer ${isAsleep ? 'bg-black' : 'bg-transparent'}`}
          aria-label="Wake display"
          tabIndex={isAsleep ? 0 : -1}
        />
      )}
    </DisplayContext.Provider>
  );
};

export default SleepMode;
