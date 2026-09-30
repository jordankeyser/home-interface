import { useMemo, useState, useEffect } from 'react';
import { useCTA } from '../../../hooks/useCTA';
import { useDisplay } from '../../../hooks/useDisplay';
import { RefreshIcon, WarningIcon, TrainIcon } from '../../icons';

/** Official CTA line colours and names, keyed by the API's route codes. */
const LINES = {
  Red: { name: 'Red Line', color: '#c60c30' },
  Blue: { name: 'Blue Line', color: '#00a1de' },
  Brn: { name: 'Brown Line', color: '#62361b' },
  G: { name: 'Green Line', color: '#009b3a' },
  Org: { name: 'Orange Line', color: '#f9461c' },
  P: { name: 'Purple Line', color: '#522398' },
  Pink: { name: 'Pink Line', color: '#e27ea6' },
  Y: { name: 'Yellow Line', color: '#f9e300' },
};

/** Arrivals after the first one, shown as "then 7, 15 min". */
const FOLLOWING = 2;

/** A train this far past its arrival time has left; stop showing it. */
const DEPARTED_MS = 60_000;

/** "Service toward Loop" → "Toward Loop"; the heading doesn't need the preamble. */
const directionLabel = (stpDe) => stpDe.replace(/^service\s+/i, '');

const minutesUntil = (train, now) => Math.round((train.dueAt - now) / 60_000);

const isDue = (train, now) => train.isApp === '1' || minutesUntil(train, now) <= 0;

/**
 * One line and destination: the next train large, the ones after it small.
 * A transit board is read from across the room, so the next arrival is the
 * only number that has to be legible at a glance.
 */
const RouteRow = ({ trains, now }) => {
  const [next, ...rest] = trains;
  const line = LINES[next.rt];
  const due = isDue(next, now);
  const mins = minutesUntil(next, now);
  const later = rest.slice(0, FOLLOWING).map((t) => Math.max(1, minutesUntil(t, now)));

  const notes = [line?.name ?? next.rt];
  if (later.length > 0) notes.push(`then ${later.join(', ')} min`);

  return (
    <div className="card-inset flex min-h-[60px] items-center gap-3.5 py-2 pr-4 pl-3">
      <span
        className="h-11 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: line?.color ?? 'var(--fg-faint)' }}
      />

      <div className="min-w-0 flex-1">
        <div className="truncate text-lg leading-tight font-semibold text-fg">{next.destNm}</div>
        <div className="nums flex min-w-0 items-center gap-2 text-sm leading-snug text-fg-muted">
          <span className="truncate">{notes.join(' · ')}</span>
          {next.isDly === '1' && (
            <span className="shrink-0 font-semibold text-warning">Delayed</span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {due ? (
          <span className="text-2xl font-bold text-accent">Due</span>
        ) : (
          <span className="nums text-3xl leading-none font-semibold text-fg">
            {mins}
            <span className="ml-1 text-sm font-medium text-fg-muted">min</span>
          </span>
        )}
        {/* Scheduled arrivals are the timetable, not a tracked train. */}
        {next.isSch === '1' && (
          <div className="mt-0.5 text-xs font-medium text-fg-faint">Scheduled</div>
        )}
      </div>
    </div>
  );
};

const TrainModule = () => {
  const { arrivals, loading, error, stale, lastUpdated, refresh, stationName } = useCTA();
  const { isAsleep } = useDisplay();
  const [tick, setTick] = useState(() => Date.now());

  // Countdowns stay accurate between fetches. The first tick fires straight
  // away so waking the panel never computes against the time it fell asleep.
  useEffect(() => {
    if (isAsleep) return undefined;
    const update = () => setTick(Date.now());
    const first = setTimeout(update, 0);
    const id = setInterval(update, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [isAsleep]);

  // Never count from before the latest fetch. After a long sleep `tick` can
  // be hours old for a moment, which is what turned "4 min" into "1123 min".
  const now = Math.max(tick, lastUpdated?.getTime() ?? 0);

  // Mon–Thu the Loop platform matters most; Fri–Sun it's the other direction.
  const loopFirst = useMemo(() => {
    const day = new Date(now).getDay();
    return day >= 1 && day <= 4;
  }, [now]);

  const directions = useMemo(() => {
    const byDirection = new Map();

    arrivals
      .filter((train) => train.dueAt > now - DEPARTED_MS)
      .sort((a, b) => a.dueAt - b.dueAt)
      .forEach((train) => {
        const direction = train.stpDe || train.destNm;
        if (!byDirection.has(direction)) byDirection.set(direction, new Map());
        const routes = byDirection.get(direction);
        const route = `${train.rt}\n${train.destNm}`;
        if (!routes.has(route)) routes.set(route, []);
        routes.get(route).push(train);
      });

    // Routes inside a direction come out in order of their next arrival,
    // because the trains were sorted before grouping.
    return [...byDirection.entries()]
      .map(([direction, routes]) => ({ direction, routes: [...routes.values()] }))
      .sort((a, b) => {
        const aLoop = a.direction.toLowerCase().includes('loop');
        const bLoop = b.direction.toLowerCase().includes('loop');
        if (aLoop === bLoop) return 0;
        if (loopFirst) return aLoop ? -1 : 1;
        return aLoop ? 1 : -1;
      });
  }, [arrivals, now, loopFirst]);

  if (loading && arrivals.length === 0) {
    return (
      <div className="card flex h-full w-full items-center justify-center">
        <div className="text-base font-medium text-fg-muted">Loading arrivals…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card flex h-full w-full flex-col items-center justify-center gap-4 p-6">
        <WarningIcon className="h-9 w-9 text-danger" />
        <div className="text-center">
          <div className="text-base font-semibold text-fg">Arrivals unavailable</div>
          <div className="mt-1 text-sm text-fg-muted">{error}</div>
        </div>
        <button type="button" onClick={refresh} className="btn">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="card flex h-full w-full min-w-0 flex-col overflow-hidden p-4">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3 pl-1">
        <h2 className="flex min-w-0 items-center gap-2.5 text-xl font-semibold text-fg">
          <TrainIcon className="h-6 w-6 shrink-0 text-accent" />
          <span className="truncate">{stationName || 'Arrivals'}</span>
        </h2>

        <div className="flex shrink-0 items-center gap-2">
          {stale ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-warning">
              <WarningIcon className="h-4 w-4" />
              Offline
            </span>
          ) : (
            lastUpdated && (
              <span className="nums text-xs text-fg-faint">
                Updated{' '}
                {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )
          )}

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="icon-btn"
            aria-label="Refresh arrivals"
          >
            <RefreshIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Native scrolling only: see "Touchscreen" in CLAUDE.md. */}
      <div className="scroll-y train-scroll-mask min-h-0 flex-1 pr-1 pb-6">
        {directions.length === 0 ? (
          <div className="mt-12 text-center text-base text-fg-muted">No trains scheduled</div>
        ) : (
          <div className="space-y-3">
            {directions.map(({ direction, routes }) => (
              <section key={direction}>
                <h3 className="eyebrow mb-2 truncate px-1">{directionLabel(direction)}</h3>
                <div className="space-y-2">
                  {routes.map((trains) => (
                    <RouteRow key={`${trains[0].rt}-${trains[0].destNm}`} trains={trains} now={now} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainModule;
