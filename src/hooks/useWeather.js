import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from './useSettings';
import { useDisplay } from './useDisplay';
import { fetchJson, isAbortError, backoffDelay } from '../lib/fetchJson';

const REFRESH_MS = 15 * 60_000;
const GEO_CACHE_KEY = 'home-interface-geocache';

/**
 * Zip -> lat/lon is stable forever, so cache it. The old version re-geocoded
 * the same zip code on every 15-minute weather refresh.
 */
const readGeoCache = () => {
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY)) || {};
  } catch {
    return {};
  }
};

const writeGeoCache = (cache) => {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable — the cache is an optimisation, not required.
  }
};

const geocodeZip = async (zip, signal) => {
  const cache = readGeoCache();
  if (cache[zip]) return cache[zip];

  const data = await fetchJson(`https://api.zippopotam.us/us/${zip}`, { signal });
  const place = data?.places?.[0];
  if (!place) throw new Error('Zip code not found');

  const entry = {
    lat: place.latitude,
    lon: place.longitude,
    name: `${place['place name']}, ${place['state abbreviation']}`,
  };

  writeGeoCache({ ...cache, [zip]: entry });
  return entry;
};

const WEATHER_FIELDS = [
  'current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day',
  'precipitation,weather_code,cloud_cover,wind_speed_10m',
].join(',');

export const useWeather = () => {
  const { settings } = useSettings();
  const { isAsleep } = useDisplay();
  const [weather, setWeather] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const attemptRef = useRef(0);
  const zip = (settings.zipCode || '').trim();

  const fetchWeather = useCallback(async () => {
    if (!zip) {
      setError('Zip code required');
      return;
    }

    // Cancel any in-flight request so a slow one can't clobber this result.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      const { lat, lon, name } = await geocodeZip(zip, controller.signal);
      setLocationName(name);

      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&${WEATHER_FIELDS}` +
        '&hourly=temperature_2m,weather_code' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset' +
        '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch' +
        '&timezone=auto&forecast_days=2';

      const data = await fetchJson(url, { signal: controller.signal });
      setWeather(data);
      setError(null);
      attemptRef.current = 0;
    } catch (err) {
      if (isAbortError(err)) return;
      console.error('Weather fetch failed:', err);
      attemptRef.current += 1;
      // Keep showing the last good reading; only surface an error if we have
      // nothing at all to display.
      setError(err.message || 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  }, [zip]);

  useEffect(() => {
    if (isAsleep) return undefined;

    fetchWeather();

    let cancelled = false;
    let timer;

    const schedule = () => {
      const delay =
        attemptRef.current > 0
          ? backoffDelay(attemptRef.current, 30_000)
          : REFRESH_MS;
      timer = setTimeout(async () => {
        if (cancelled) return;
        await fetchWeather();
        if (!cancelled) schedule();
      }, delay);
    };

    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [fetchWeather, isAsleep]);

  return {
    weather,
    locationName,
    loading,
    // Only treat it as an error state if there's nothing to show.
    error: weather ? null : error,
    stale: Boolean(weather && error),
    refresh: fetchWeather,
  };
};
