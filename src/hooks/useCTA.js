import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from './useSettings';
import { useDisplay } from './useDisplay';
import { fetchJson, isAbortError, backoffDelay } from '../lib/fetchJson';

/** 20s keeps arrival countdowns accurate at half the old request volume. */
const REFRESH_MS = 20_000;

export const useCTA = () => {
  const { settings } = useSettings();
  const { isAsleep } = useDisplay();
  const [arrivals, setArrivals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stationName, setStationName] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  const abortRef = useRef(null);
  const attemptRef = useRef(0);

  const apiKey = (settings.ctaApiKey || '').trim();
  const stationId = (settings.ctaStationId || '').trim();

  const fetchArrivals = useCallback(async () => {
    if (!apiKey || !stationId) {
      setError('CTA API key and station ID required');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      // Proxied by the local control server so the key never appears in a
      // cross-origin request and CORS isn't an issue.
      const url = `/api/1.0/ttarrivals.aspx?key=${encodeURIComponent(
        apiKey
      )}&mapid=${encodeURIComponent(stationId)}&outputType=JSON`;

      const data = await fetchJson(url, { signal: controller.signal });

      if (data?.ctatt?.errCd !== '0') {
        throw new Error(data?.ctatt?.errNm || 'CTA API error');
      }

      const etas = data.ctatt.eta || [];
      setArrivals(etas);
      if (etas.length > 0) setStationName(etas[0].staNm);
      setLastUpdated(new Date());
      setError(null);
      attemptRef.current = 0;
    } catch (err) {
      if (isAbortError(err)) return;
      console.error('CTA fetch failed:', err);
      attemptRef.current += 1;
      setError(err.message || 'Failed to fetch arrivals');
    } finally {
      setLoading(false);
    }
  }, [apiKey, stationId]);

  useEffect(() => {
    // No point polling a station board behind a dark backlight.
    if (isPaused || isAsleep) return undefined;

    fetchArrivals();

    let cancelled = false;
    let timer;

    const schedule = () => {
      const delay =
        attemptRef.current > 0
          ? backoffDelay(attemptRef.current, REFRESH_MS, 2 * 60_000)
          : REFRESH_MS;
      timer = setTimeout(async () => {
        if (cancelled) return;
        await fetchArrivals();
        if (!cancelled) schedule();
      }, delay);
    };

    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [fetchArrivals, isPaused, isAsleep]);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);

  return {
    arrivals,
    loading,
    // Keep the last board visible through a blip rather than flashing an error.
    error: arrivals.length > 0 ? null : error,
    stale: Boolean(arrivals.length > 0 && error),
    lastUpdated,
    refresh: fetchArrivals,
    stationName,
    isPaused,
    togglePause,
  };
};
