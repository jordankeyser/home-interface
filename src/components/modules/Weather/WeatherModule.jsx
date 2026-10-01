import { useMemo } from 'react';
import { useWeather } from '../../../hooks/useWeather';
import {
  RefreshIcon,
  WindIcon,
  HumidityIcon,
  PrecipIcon,
  WarningIcon,
} from '../../icons';
import WeatherGlyph from './WeatherGlyph';
import { weatherLabel } from '../../../lib/weatherCodes';

const Stat = ({ icon: Icon, label, value, unit }) => (
  <div className="metric-chip flex min-w-0 flex-col items-center justify-center gap-0.5 text-center">
    <div className="flex min-w-0 items-center justify-center gap-1 leading-tight">
      <Icon className="h-4 w-4 shrink-0 text-fg-faint" />
      <div className="nums whitespace-nowrap text-sm font-semibold text-fg">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-fg-muted">{unit}</span>}
      </div>
    </div>
    <div className="text-xs font-medium text-fg-faint">{label}</div>
  </div>
);

const hourLabel = (time, index) =>
  index === 0
    ? 'Now'
    : new Date(time).toLocaleTimeString([], {
        hour: 'numeric',
      });

const WeatherModule = () => {
  const { weather, locationName, loading, error, stale, refresh } = useWeather();

  // Five equal columns fit the actual 800x480 panel without clipped labels or
  // a second scroll gesture competing with the page swipe.
  const HOURS_SHOWN = 5;

  const hourly = useMemo(() => {
    if (!weather?.hourly?.time) return [];

    // Anchor on the payload's own `current.time` rather than the wall clock:
    // both are local-timezone "YYYY-MM-DDTHH:MM" strings, so a lexicographic
    // compare is correct, timezone-safe, and keeps this render pure.
    const anchor = weather.current?.time ?? weather.hourly.time[0];
    const start = weather.hourly.time.findIndex((t) => t >= anchor);
    if (start < 0) return [];

    return weather.hourly.time.slice(start, start + HOURS_SHOWN).map((time, i) => ({
      time,
      temp: weather.hourly.temperature_2m[start + i],
      code: weather.hourly.weather_code[start + i],
    }));
  }, [weather]);

  if (loading && !weather) {
    return (
      <div className="card flex h-full w-full items-center justify-center">
        <div className="text-base font-medium text-fg-muted">Loading weather…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card flex h-full w-full flex-col items-center justify-center gap-4 p-6">
        <WarningIcon className="h-9 w-9 text-danger" />
        <div className="text-center">
          <div className="text-base font-semibold text-fg">Weather unavailable</div>
          <div className="mt-1 text-sm text-fg-muted">{error}</div>
        </div>
        <button type="button" onClick={refresh} className="btn">
          Try again
        </button>
      </div>
    );
  }

  if (!weather) return null;

  const current = weather.current;
  const daily = weather.daily;
  const isDay = current.is_day !== 0;

  return (
    <div className="card flex h-full w-full min-w-0 flex-col overflow-hidden p-4">
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-fg-muted">{locationName}</h2>
          {stale && (
            <span className="shrink-0 text-warning" title="Showing last known reading">
              <WarningIcon className="h-4 w-4" />
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="icon-btn shrink-0"
          aria-label="Refresh weather"
        >
          <RefreshIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 items-center gap-2 py-1">
        <WeatherGlyph
          code={current.weather_code}
          isDay={isDay}
          className="h-12 w-12 shrink-0 text-accent"
        />
        <div className="nums shrink-0 text-5xl leading-none font-semibold tracking-tighter text-fg">
          {Math.round(current.temperature_2m)}°
        </div>
        <div className="min-w-0 pl-1">
          <div className="truncate text-base font-semibold text-fg">
            {weatherLabel(current.weather_code)}
          </div>
          <div className="nums mt-1 flex flex-wrap gap-x-2 text-xs font-medium text-fg-muted">
            <span>H {Math.round(daily.temperature_2m_max[0])}°</span>
            <span>L {Math.round(daily.temperature_2m_min[0])}°</span>
            <span>Feels {Math.round(current.apparent_temperature)}°</span>
          </div>
        </div>
      </div>

      <div className="divider shrink-0" />

      <div className="grid shrink-0 grid-cols-5 gap-1 py-2">
        {hourly.map((hour, index) => (
            <div
              key={hour.time}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-xl py-1 ${
                index === 0 ? 'hour-now' : ''
              }`}
            >
              <span className="truncate text-xs font-medium text-fg-faint">
                {hourLabel(hour.time, index)}
              </span>
              <WeatherGlyph code={hour.code} className="h-5 w-5 text-fg-muted" />
              <span className="nums text-sm font-semibold text-fg">
                {Math.round(hour.temp)}°
              </span>
            </div>
          ))}
      </div>

      <div className="divider shrink-0" />
      <div className="grid shrink-0 grid-cols-3 gap-1.5 py-2">
          <Stat
            icon={WindIcon}
            label="Wind"
            value={Math.round(current.wind_speed_10m)}
            unit="mph"
          />
          <Stat
            icon={HumidityIcon}
            label="Humidity"
            value={Math.round(current.relative_humidity_2m)}
            unit="%"
          />
          <Stat
            icon={PrecipIcon}
            label="Precip"
            value={current.precipitation.toFixed(2)}
            unit="in"
          />
      </div>
    </div>
  );
};

export default WeatherModule;
