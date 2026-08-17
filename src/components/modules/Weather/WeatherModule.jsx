import { useMemo } from 'react';
import { useWeather } from '../../../hooks/useWeather';
import WeatherBackdrop from './WeatherBackdrop';
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
  <div className="flex flex-1 flex-col items-center gap-1">
    <Icon className="h-5 w-5 text-fg-faint" />
    <div className="nums text-base font-semibold text-fg">
      {value}
      {unit && <span className="ml-0.5 text-xs font-normal text-fg-muted">{unit}</span>}
    </div>
    <div className="text-xs font-medium text-fg-faint">{label}</div>
  </div>
);

const WeatherModule = () => {
  const { weather, locationName, loading, error, stale, refresh } = useWeather();

  const hourly = useMemo(() => {
    if (!weather?.hourly?.time) return [];

    // Anchor on the payload's own `current.time` rather than the wall clock:
    // both are local-timezone "YYYY-MM-DDTHH:MM" strings, so a lexicographic
    // compare is correct, timezone-safe, and keeps this render pure.
    const anchor = weather.current?.time ?? weather.hourly.time[0];
    const start = weather.hourly.time.findIndex((t) => t >= anchor);
    if (start < 0) return [];

    return weather.hourly.time.slice(start, start + 12).map((time, i) => ({
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
    <div className="card relative flex h-full w-full flex-col overflow-hidden">
      <WeatherBackdrop code={current.weather_code} isDay={isDay} />

      <button
        type="button"
        onClick={refresh}
        disabled={loading}
        className="icon-btn absolute top-3 right-3 z-20"
        aria-label="Refresh weather"
      >
        <RefreshIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
      </button>

      {/* Current conditions */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-fg-muted">
          <span className="truncate">{locationName}</span>
          {stale && (
            <span className="text-warning" title="Showing last known reading">
              <WarningIcon className="h-4 w-4" />
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-5">
          <WeatherGlyph
            code={current.weather_code}
            isDay={isDay}
            className="h-16 w-16 shrink-0 text-fg-muted"
          />
          <div className="nums text-7xl leading-none font-semibold tracking-tighter text-fg">
            {Math.round(current.temperature_2m)}°
          </div>
        </div>

        <div className="mt-3 text-lg font-medium text-fg">
          {weatherLabel(current.weather_code)}
        </div>

        <div className="nums mt-1 flex items-center gap-3 text-sm text-fg-muted">
          <span>H {Math.round(daily.temperature_2m_max[0])}°</span>
          <span className="text-fg-faint">·</span>
          <span>L {Math.round(daily.temperature_2m_min[0])}°</span>
          <span className="text-fg-faint">·</span>
          <span>Feels {Math.round(current.apparent_temperature)}°</span>
        </div>
      </div>

      {/* Hourly forecast + stats */}
      <div className="relative z-10 shrink-0 px-3 pb-3">
        <div className="divider mb-2" />

        <div
          className="scroll-x scrollbar-hide edge-fade-x flex gap-1 pb-1"
          style={{ scrollSnapType: 'x proximity' }}
        >
          {hourly.map((hour) => (
            <div
              key={hour.time}
              className="flex min-w-[3.5rem] shrink-0 flex-col items-center gap-1.5 rounded-xl py-1.5"
              style={{ scrollSnapAlign: 'start' }}
            >
              <span className="text-xs font-medium text-fg-faint">
                {new Date(hour.time)
                  .toLocaleTimeString([], { hour: 'numeric' })
                  .replace(' ', '')}
              </span>
              <WeatherGlyph code={hour.code} className="h-5 w-5 text-fg-muted" />
              <span className="nums text-sm font-semibold text-fg">
                {Math.round(hour.temp)}°
              </span>
            </div>
          ))}
        </div>

        <div className="divider my-2" />

        <div className="flex items-start justify-around">
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
    </div>
  );
};

export default WeatherModule;
