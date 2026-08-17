import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DisplayContext } from '../context/displayStore';
import { useSettings } from '../hooks/useSettings';
import {
  displayOff,
  displayOn,
  setBrightness,
  ambientBrightness,
} from '../lib/displayApi';

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
  const timerRef = useRef(null);
  const brightnessRef = useRef(null);

  const idleMs = Math.max(0, Number(settings.idleSleepMinutes) || 0) * 60_000;
  const ambientDimming = settings.ambientDimming !== false;

  const sleep = useCallback(() => {
    setIsAsleep((asleep) => {
      if (!asleep) displayOff();
      return true;
    });
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const wake = useCallback(() => {
    setIsAsleep((asleep) => {
      if (asleep) {
        displayOn();
        if (ambientDimming) setBrightness(ambientBrightness());
      }
      return false;
    });
  }, [ambientDimming]);

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

  // Ambient dimming: follow a day/night curve while awake. The backlight server
  // takes any 0–100 value, but the old client only ever sent full-on or off.
  useEffect(() => {
    if (!ambientDimming || isAsleep) return undefined;

    const apply = () => {
      const next = Math.round(ambientBrightness());
      if (brightnessRef.current === next) return;
      brightnessRef.current = next;
      setBrightness(next);
    };

    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, [ambientDimming, isAsleep]);

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

      {isAsleep && (
        <button
          type="button"
          onPointerDown={wake}
          className="fixed inset-0 z-[100] h-full w-full cursor-pointer bg-black"
          aria-label="Wake display"
        />
      )}
    </DisplayContext.Provider>
  );
};

export default SleepMode;
