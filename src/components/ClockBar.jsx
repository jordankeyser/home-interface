import { useState, useEffect } from 'react';
import { SettingsIcon, OfflineIcon } from './icons';
import { useOnline } from '../hooks/useOnline';
import { useDisplay } from '../hooks/useDisplay';

/**
 * The clock is the thing you glance at most from across the room, so it is the
 * largest element on the panel. It used to be `text-3xl` while the weather
 * temperature was `text-7xl` — the hierarchy was inverted for the viewing
 * distance.
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
    <div className="card relative flex shrink-0 items-center px-6 py-5">
      <div className="min-w-0 pr-12">
        <div className="flex items-baseline gap-2">
          <span className="nums text-6xl leading-none font-semibold tracking-tight text-fg">
            {clock}
          </span>
          {meridiem && (
            <span className="text-lg font-medium text-fg-muted">{meridiem}</span>
          )}
        </div>
        <div className="mt-2 truncate text-sm font-medium text-fg-muted">
          {now.toLocaleDateString([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Anchored to the card's actual top-right corner, matching the
          refresh-button placement in Weather/Train, rather than floating
          mid-height alongside the clock text. */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
        {!online && (
          <span
            className="flex h-10 w-10 items-center justify-center text-warning"
            title="No network connection"
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
