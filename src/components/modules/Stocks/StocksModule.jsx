import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { useDisplay } from '../../../hooks/useDisplay';
import { getProvider, parseSymbols } from '../../../lib/stockProviders';
import { isAbortError } from '../../../lib/fetchJson';
import { PauseIcon, PlayIcon, TrendUpIcon, TrendDownIcon } from '../../icons';

const PX_PER_SECOND = 26;
const MIN_DURATION_S = 20;

const StocksModule = () => {
  const { settings } = useSettings();
  const { isAsleep } = useDisplay();

  const symbols = useMemo(
    () => parseSymbols(settings.stockSymbols),
    [settings.stockSymbols]
  );
  const apiKey = (settings.stockApiKey || '').trim();
  const provider = useMemo(
    () => getProvider(settings.stockProvider),
    [settings.stockProvider]
  );

  const [quotes, setQuotes] = useState(() => new Map());
  const [paused, setPaused] = useState(false);
  const [tickerStyle, setTickerStyle] = useState({});

  const trackRef = useRef(null);
  const symbolKey = symbols.join(',');

  // One symbol per tick, spaced to respect the provider's quota. Every request
  // is abortable so a slow response can't overwrite a newer quote.
  useEffect(() => {
    if (!apiKey || symbols.length === 0 || isAsleep) return undefined;

    const controller = new AbortController();
    let index = 0;
    let cancelled = false;

    const spacing = Math.max(
      provider.minRequestMs,
      Math.floor(provider.cycleMs / symbols.length)
    );

    const tick = async () => {
      const symbol = symbols[index % symbols.length];
      index += 1;

      try {
        const quote = await provider.fetchQuote(symbol, apiKey, controller.signal);
        if (cancelled) return;
        setQuotes((prev) => new Map(prev).set(quote.symbol, quote));
      } catch (err) {
        if (isAbortError(err) || cancelled) return;
        // Keep the last good quote on screen; a missing one just renders as the
        // bare symbol rather than blanking the whole ticker.
        console.warn(`[stocks] ${symbol}:`, err.message);
      }
    };

    tick();
    const id = setInterval(tick, spacing);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [apiKey, symbolKey, symbols, provider, isAsleep]);

  // Marquee geometry: items render twice, so half the track is one full cycle.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;

    const compute = () => {
      const half = Math.max(1, Math.floor(el.scrollWidth / 2));
      setTickerStyle({
        '--ticker-distance': `-${half}px`,
        '--ticker-duration': `${Math.max(
          MIN_DURATION_S,
          Math.round(half / PX_PER_SECOND)
        )}s`,
      });
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [symbolKey, quotes.size]);

  const items = useMemo(() => {
    const base = symbols.length ? symbols : ['AAPL', 'MSFT', 'TSLA'];
    const row = base.map((symbol) => ({ symbol, quote: quotes.get(symbol) }));
    return [...row, ...row];
  }, [symbols, quotes]);

  const status = !apiKey ? 'Needs API key' : paused ? 'Paused' : 'Live';

  return (
    <div className="card flex h-full w-full min-w-0 flex-col overflow-hidden px-4 py-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="eyebrow">Markets</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-fg-faint">{status}</span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="icon-btn icon-btn-sm"
            data-state={paused ? 'on' : 'off'}
            aria-label={paused ? 'Resume ticker' : 'Pause ticker'}
          >
            {paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="stock-ticker-mask relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={trackRef}
          className={`stock-ticker-track flex h-full items-center gap-8 whitespace-nowrap will-change-transform ${
            paused ? 'stock-ticker-paused' : ''
          }`}
          style={tickerStyle}
          aria-label="Stock ticker"
        >
          {items.map(({ symbol, quote }, idx) => {
            const pct = quote?.changePct;
            const hasPct = typeof pct === 'number' && Number.isFinite(pct);
            const isUp = hasPct && pct >= 0;
            const Trend = isUp ? TrendUpIcon : TrendDownIcon;

            return (
              <div key={`${symbol}-${idx}`} className="flex items-center gap-2.5">
                <span className="text-base font-semibold tracking-wide text-fg">
                  {symbol}
                </span>
                {typeof quote?.price === 'number' && (
                  <span className="nums text-sm text-fg-muted">
                    {quote.price.toFixed(2)}
                  </span>
                )}
                {hasPct && (
                  <span
                    className="nums flex items-center gap-1 text-sm font-medium"
                    style={{ color: isUp ? 'var(--positive)' : 'var(--negative)' }}
                  >
                    <Trend className="h-3.5 w-3.5" />
                    {`${isUp ? '+' : ''}${pct.toFixed(2)}%`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StocksModule;
