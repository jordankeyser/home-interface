import {
  SunIcon,
  MoonIcon,
  CloudIcon,
  PartlyCloudyIcon,
  RainIcon,
  DrizzleIcon,
  SnowIcon,
  SleetIcon,
  StormIcon,
  FogIcon,
} from '../../icons';

/**
 * Renders the icon for a WMO weather code.
 *
 * This is a component that returns elements rather than a function that returns
 * a component type — the latter reads as "component created during render" even
 * when the reference is stable.
 *
 * Code table: https://open-meteo.com/en/docs
 */
const WeatherGlyph = ({ code, isDay = true, className = 'h-6 w-6' }) => {
  if (code === 0) {
    return isDay ? <SunIcon className={className} /> : <MoonIcon className={className} />;
  }
  if (code === 1 || code === 2) return <PartlyCloudyIcon className={className} />;
  if (code === 3) return <CloudIcon className={className} />;
  if (code === 45 || code === 48) return <FogIcon className={className} />;
  if (code >= 51 && code <= 57) return <DrizzleIcon className={className} />;
  if (code >= 61 && code <= 65) return <RainIcon className={className} />;
  if (code === 66 || code === 67) return <SleetIcon className={className} />;
  if (code >= 71 && code <= 77) return <SnowIcon className={className} />;
  if (code >= 80 && code <= 82) return <RainIcon className={className} />;
  if (code === 85 || code === 86) return <SnowIcon className={className} />;
  if (code >= 95) return <StormIcon className={className} />;
  return <CloudIcon className={className} />;
};

export default WeatherGlyph;
