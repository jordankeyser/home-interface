import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../../context/SettingsContext';

const REFRESH_ALL_MS = 60_000;
const PER_REQUEST_DELAY_MS = 1100; // Alpha Vantage guidance: ~1 request/second
const PX_PER_SECOND = 28; // slow, constant movement
const MIN_DURATION_S = 18;

function parseSymbols(input) {
  if (!input) return [];
  return input
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
}

async function fetchFinnhubQuote(symbol, token) {
  // deprecated (kept only to avoid unused-function churn if you swap providers later)
  void symbol;
  void token;
  throw new Error('Finnhub is not configured');
}

async function fetchAlphaVantageQuote(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Quote failed (${res.status})`);
  const data = await res.json();

  if (data?.Note) throw new Error('Alpha Vantage rate limit hit. Quotes will resume shortly.');
  if (data?.Information) throw new Error(String(data.Information));
  if (data?.['Error Message']) throw new Error('Invalid symbol or request.');

  const q = data?.['Global Quote'];
  const price = Number(q?.['05. price']);
  const change = Number(q?.['09. change']);
  const changePctRaw = String(q?.['10. change percent'] || '');
  const changePct = Number(changePctRaw.replace('%', ''));

  return {
    symbol,
    price,
    change,
    changePct,
    ts: Date.now(),
  };
}

const StocksModule = () => {
  const { settings, currentTheme } = useSettings();
  const theme = currentTheme.colors;

  const moduleCard = theme.moduleCard || `${theme.moduleBg} ${theme.border} border shadow-xl rounded-3xl`;
  const symbols = useMemo(() => parseSymbols(settings.stockSymbols), [settings.stockSymbols]);
  const apiKey = (settings.stockApiKey || '').trim();

  const [quotes, setQuotes] = useState(() => new Map());
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const runIdRef = useRef(0);
  const timeoutRef = useRef(null);

  const trackRef = useRef(null);
  const [tickerStyle, setTickerStyle] = useState({});

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const refreshAll = async (runId) => {
    if (!apiKey || symbols.length === 0) {
      setError('');
      setQuotes(new Map());
      return;
    }

    setIsRefreshing(true);
    try {
      const next = new Map(quotes);
      for (let i = 0; i < symbols.length; i++) {
        if (runIdRef.current !== runId) return; // cancelled/restarted
        const sym = symbols[i];
        // Spread requests to ~1/sec (no bursts)
        if (i > 0) await sleep(PER_REQUEST_DELAY_MS);
        const q = await fetchAlphaVantageQuote(sym, apiKey);
        next.set(q.symbol, q);
      }
      if (runIdRef.current !== runId) return;
      setQuotes(next);
      setError('');
    } catch (e) {
      if (runIdRef.current !== runId) return;
      setError(e?.message || 'Failed to load stocks');
    } finally {
      if (runIdRef.current === runId) setIsRefreshing(false);
    }
  };

  const scheduleLoop = (runId) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const tick = async () => {
      await refreshAll(runId);
      if (runIdRef.current !== runId) return;
      timeoutRef.current = setTimeout(tick, REFRESH_ALL_MS);
    };
    tick();
  };

  const handleManualRefresh = () => {
    runIdRef.current += 1;
    scheduleLoop(runIdRef.current);
  };

  // Start/Restart the refresh loop when symbols/apiKey change
  useEffect(() => {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    scheduleLoop(runId);
    return () => {
      runIdRef.current += 1;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(','), apiKey]);

  // Compute marquee distance/duration for seamless, constant movement
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const compute = () => {
      // We render the items twice; half the scrollWidth is one full cycle.
      const half = Math.max(1, Math.floor(el.scrollWidth / 2));
      const duration = Math.max(MIN_DURATION_S, Math.round(half / PX_PER_SECOND));
      setTickerStyle({
        '--ticker-distance': `-${half}px`,
        '--ticker-duration': `${duration}s`,
      });
    };

    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [symbols.length, quotes.size]);

  const items = useMemo(() => {
    // Always render something for smooth motion, even before quotes load.
    const base = symbols.length ? symbols : ['AAPL', 'MSFT', 'TSLA'];
    const makeItem = (sym) => {
      const q = quotes.get(sym);
      const price = q?.price;
      const changePct = q?.changePct;
      const isUp = typeof changePct === 'number' ? changePct >= 0 : true;
      return {
        symbol: sym,
        price,
        changePct,
        isUp,
      };
    };
    const row = base.map(makeItem);
    return [...row, ...row]; // duplicate for seamless loop
  }, [symbols, quotes]);

  return (
    <div className={`w-full h-full ${moduleCard} p-2 flex flex-col min-w-0 overflow-hidden`}>
      <div className="flex items-center justify-between mb-0.5">
        <div className={`min-w-0 text-base md:text-lg font-bold ${theme.textPrimary} flex items-center gap-2`}>
          <span className={`w-1.5 h-5 ${theme.accentColor} rounded-full`} />
          <span className="truncate">Portfolio</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className={`text-[10px] ${theme.textSecondary} whitespace-nowrap`}>
            {error ? 'Error' : apiKey ? 'Live' : 'Needs API key'}
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={!apiKey || isRefreshing}
            className={`p-1.5 rounded-full ${theme.moduleHover} ${theme.buttonActive} transition-all touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center ${isRefreshing ? 'animate-spin opacity-60' : ''}`}
            title="Refresh Portfolio"
            aria-label="Refresh Portfolio"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${theme.textSecondary}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {!apiKey && (
        <div className={`${theme.textSecondary} text-xs`}>
          Add a Stock API key in Settings to load quotes.
        </div>
      )}
      {apiKey && error && (
        <div className="text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="mt-0.5 relative flex-1 min-h-0 overflow-hidden stock-ticker-mask">
        <div
          ref={trackRef}
          className="stock-ticker-track flex items-center gap-6 whitespace-nowrap will-change-transform"
          style={tickerStyle}
          aria-label="Scrolling stock ticker"
        >
          {items.map((it, idx) => (
            <div key={`${it.symbol}-${idx}`} className="flex items-center gap-2">
              <span className={`${theme.textPrimary} text-lg font-semibold tracking-wide`}>
                {it.symbol}
              </span>
              <span className={`${theme.textSecondary} text-sm tabular-nums`}>
                {typeof it.price === 'number' && it.price > 0 ? it.price.toFixed(2) : '--'}
              </span>
              <span
                className={`text-sm tabular-nums font-medium ${it.isUp ? 'text-emerald-300' : 'text-rose-300'}`}
              >
                {typeof it.changePct === 'number'
                  ? `${it.changePct >= 0 ? '+' : ''}${it.changePct.toFixed(2)}%`
                  : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StocksModule;


