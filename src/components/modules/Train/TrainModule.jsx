import { useMemo, useState, useEffect } from 'react';
import { useCTA } from '../../../hooks/useCTA';
import { useDisplay } from '../../../hooks/useDisplay';
import {
  RefreshIcon,
  PauseIcon,
  PlayIcon,
  ChevronDownIcon,
  WarningIcon,
  TrainIcon,
} from '../../icons';

/** Official CTA line colours, keyed by the API's route codes. */
const LINE_COLORS = {
  Red: '#c60c30',
  Blue: '#00a1de',
  Brn: '#62361b',
  G: '#009b3a',
  Org: '#f9461c',
  P: '#522398',
  Pink: '#e27ea6',
  Y: '#f9e300',
};

const COLLAPSED_ROWS = 3;
const EXPANDED_ROWS = 6;

const TrainModule = () => {
  const {
    arrivals,
    loading,
    error,
    stale,
    lastUpdated,
    refresh,
    stationName,
    isPaused,
    togglePause,
  } = useCTA();
  const { isAsleep } = useDisplay();

  const [expanded, setExpanded] = useState(() => new Set());
  const [now, setNow] = useState(() => Date.now());

  // Countdowns stay accurate between fetches. setState here is inside an
  // interval callback, which is the supported pattern.
  useEffect(() => {
    if (isAsleep) return undefined;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [isAsleep]);

  const minutesUntil = (arrT) => {
    const mins = Math.round((new Date(arrT).getTime() - now) / 60_000);
    return mins <= 0 ? null : mins;
  };

  // Mon–Thu the Loop platform matters most; Fri–Sun it's the other direction.
  const loopFirst = useMemo(() => {
    const day = new Date(now).getDay();
    return day >= 1 && day <= 4;
  }, [now]);

  const groups = useMemo(() => {
    const byDirection = new Map();

    arrivals.forEach((train) => {
      const key = train.stpDe || train.destNm;
      if (!byDirection.has(key)) byDirection.set(key, []);
      byDirection.get(key).push(train);
    });

    const entries = [...byDirection.entries()];
    entries.forEach(([, trains]) =>
      trains.sort((a, b) => new Date(a.arrT) - new Date(b.arrT))
    );

    return entries.sort((a, b) => {
      const aLoop = a[0].toLowerCase().includes('loop');
      const bLoop = b[0].toLowerCase().includes('loop');
      if (aLoop === bLoop) return 0;
      if (loopFirst) return aLoop ? -1 : 1;
      return aLoop ? 1 : -1;
    });
  }, [arrivals, loopFirst]);

  const toggle = (direction) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(direction)) next.delete(direction);
      else next.add(direction);
      return next;
    });

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
      <div className="mb-1.5 flex shrink-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-xl font-semibold text-fg">
          <TrainIcon className="h-6 w-6 shrink-0 text-accent" />
          <span className="truncate">{stationName || 'Arrivals'}</span>
        </h2>

        <div className="flex shrink-0 items-center gap-0.5">
          {stale ? (
            <span className="text-warning" title="Showing last known arrivals">
              <WarningIcon className="h-4 w-4" />
            </span>
          ) : (
            lastUpdated && (
              <span className="nums mr-1 hidden text-xs text-fg-faint md:block">
                {lastUpdated.toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            )
          )}

          <button
            type="button"
            onClick={togglePause}
            className="icon-btn"
            data-state={isPaused ? 'on' : 'off'}
            aria-label={isPaused ? 'Resume updates' : 'Pause updates'}
          >
            {isPaused ? <PlayIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={refresh}
            disabled={loading || isPaused}
            className="icon-btn"
            aria-label="Refresh arrivals"
          >
            <RefreshIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Native scrolling — the previous version reimplemented touch scrolling
          with preventDefault + manual scrollTop, which threw away momentum and
          rubber-banding and made the list feel dead under a finger. */}
      <div className="scroll-y train-scroll-mask min-h-0 flex-1 pr-1">
        {groups.length === 0 ? (
          <div className="mt-12 text-center text-base text-fg-muted">
            No trains scheduled
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(([direction, trains]) => {
              const isOpen = expanded.has(direction);
              const limit = isOpen ? EXPANDED_ROWS : COLLAPSED_ROWS;
              const hasMore = trains.length > COLLAPSED_ROWS;

              return (
                <div key={direction}>
                  <button
                    type="button"
                    onClick={() => hasMore && toggle(direction)}
                    disabled={!hasMore}
                    className="mb-1.5 flex min-h-[40px] w-full items-center justify-between gap-2 rounded-xl px-1 text-left disabled:cursor-default"
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Show fewer' : 'Show more'} trains toward ${direction}`}
                  >
                    <span className="eyebrow min-w-0 truncate">{direction}</span>
                    {hasMore && (
                      <ChevronDownIcon
                        className={`h-5 w-5 shrink-0 text-fg-faint transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </button>

                  <div className="space-y-2">
                    {trains.slice(0, limit).map((train) => {
                      const mins = minutesUntil(train.arrT);
                      const isDue = mins === null;
                      const isApproaching = mins !== null && mins <= 2;

                      return (
                        <div
                          key={train.rn}
                          className="card-inset card-inset-hover flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="h-6 w-1.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor:
                                  LINE_COLORS[train.rt] || 'var(--fg-faint)',
                              }}
                            />
                            <span className="truncate text-base font-semibold text-fg">
                              {train.destNm}
                            </span>
                          </div>

                          <div
                            className={`nums shrink-0 text-right text-xl font-semibold ${
                              isDue || isApproaching ? 'text-accent' : 'text-fg'
                            }`}
                          >
                            {isDue ? (
                              'Due'
                            ) : (
                              <>
                                {mins}
                                <span className="ml-1 text-sm font-medium text-fg-muted">
                                  min
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainModule;
