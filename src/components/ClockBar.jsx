import { useState, useEffect } from 'react';
import { SettingsIcon, OfflineIcon } from './icons';
import { useOnline } from '../hooks/useOnline';
import { useDisplay } from '../hooks/useDisplay';

/**
 * Compact enough to leave the weather room on an 800x480 panel, while keeping
 * the time legible from across the room.
 */
const ClockBar = ({ onSettingsClick }) => {
  const [now, setNow] = useState(() => new Date());
  const online = useOnline();
  const { isAsleep } = useDisplay();

  useEffect(() => {
    if (isAsleep) return undefined;

    // Tick on the minute boundary rather than every second: the display only
    // shows minutes, so a 1s interval was 60x more renders than needed.
    let timer;

    const schedule = () => {
      const d = new Date();
      setNow(d);
      const msToNextMinute = 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds());
      timer = setTimeout(schedule, msToNextMinute + 50);
    };

    schedule();
    return () => clearTimeout(timer);
  }, [isAsleep]);

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const [clock, meridiem] = time.split(' ');

  return (
    <div className="card flex shrink-0 items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="nums text-5xl leading-none font-semibold tracking-tight text-fg">
            {clock}
          </span>
          {meridiem && (
            <span className="text-lg font-medium text-fg-muted">{meridiem}</span>
          )}
        </div>
        <div className="mt-1.5 truncate text-sm font-medium text-fg-muted">
          {now.toLocaleDateString([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!online && (
          <span
            className="flex h-12 w-8 items-center justify-center text-warning"
            title="No network connection"
            role="status"
          >
            <OfflineIcon className="h-5 w-5" />
          </span>
        )}
        <button
          type="button"
          onClick={onSettingsClick}
          className="icon-btn"
          aria-label="Open settings"
        >
          <SettingsIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default ClockBar;
