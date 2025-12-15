import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../../context/SettingsContext';

const REFRESH_ALL_MS = 60_000;
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

  const trackRef = useRef(null);
  const [tickerStyle, setTickerStyle] = useState({});

  // Fetch all quotes at once (once per minute).
  useEffect(() => {
    let cancelled = false;

    async function refreshAll() {
      if (!apiKey || symbols.length === 0) {
        if (!cancelled) {
          setError('');
          setQuotes(new Map());
        }
        return;
      }

      try {
        if (cancelled) return;
        const results = await Promise.all(symbols.map((sym) => fetchAlphaVantageQuote(sym, apiKey)));
        if (cancelled) return;
        const next = new Map();
        results.forEach((q) => next.set(q.symbol, q));
        setQuotes(next);
        setError('');
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load stocks');
      }
    }

    // Kick off an immediate fetch for the first symbol.
    refreshAll();
    const id = setInterval(refreshAll, REFRESH_ALL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbols, apiKey]);

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
        <div className={`text-[10px] ${theme.textSecondary} whitespace-nowrap`}>
          {error ? 'Error' : apiKey ? 'Live' : 'Needs API key'}
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


