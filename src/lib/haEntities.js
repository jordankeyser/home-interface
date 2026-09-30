/**
 * Which Home Assistant entities the panel shows, and how to read and control
 * them. Everything domain-specific lives here, so supporting a new kind of
 * device is one entry in DOMAINS plus an icon in DeviceTile — not a change to
 * the connection or the page.
 *
 * Only simple on/off devices for now. Climate, covers and locks need their own
 * controls rather than a toggle tile.
 */

export const DOMAINS = {
  light: { label: 'Light' },
  switch: { label: 'Switch' },
  fan: { label: 'Fan' },
};

export const SUPPORTED_DOMAINS = new Set(Object.keys(DOMAINS));

export const domainOf = (entityId) => entityId.slice(0, entityId.indexOf('.'));

export const isSupported = (entityId) => SUPPORTED_DOMAINS.has(domainOf(entityId));

export const isOn = (entity) => entity.state === 'on';

export const isUnavailable = (entity) => entity.state === 'unavailable';

export const isLight = (entity) => domainOf(entity.entity_id) === 'light';

const colorModes = (entity) => entity.attributes?.supported_color_modes || [];

/** Modes that take any colour, not just shades of white. */
const COLOR_MODES = new Set(['hs', 'xy', 'rgb', 'rgbw', 'rgbww']);

export const supportsColor = (entity) =>
  isLight(entity) && colorModes(entity).some((m) => COLOR_MODES.has(m));

/** Tunable white. Colour bulbs usually do this too. */
export const supportsColorTemp = (entity) =>
  isLight(entity) && colorModes(entity).includes('color_temp');

/** The bulb's white range in kelvin, falling back to a typical bulb's. */
export const colorTempRange = (entity) => ({
  min: entity.attributes?.min_color_temp_kelvin ?? 2700,
  max: entity.attributes?.max_color_temp_kelvin ?? 6500,
});

/** Dimmable lights report at least one colour mode other than plain on/off. */
export const supportsBrightness = (entity) =>
  domainOf(entity.entity_id) === 'light' &&
  (entity.attributes?.supported_color_modes || []).some((m) => m !== 'onoff');

/** HA stores brightness as 0–255; people think in percent. */
export const brightnessPct = (entity) => {
  const b = entity.attributes?.brightness;
  return typeof b === 'number' ? Math.max(1, Math.round((b / 255) * 100)) : null;
};

export const friendlyName = (entity) =>
  entity.attributes?.friendly_name || entity.entity_id;

/**
 * "Living Room Lamp" reads as "Lamp" under a Living Room heading — the same
 * trimming Home Assistant's own dashboards do. Falls back to the full name
 * when trimming would leave nothing.
 */
export const displayName = (entity, areaName) => {
  const name = friendlyName(entity);
  if (!areaName) return name;
  const prefix = `${areaName} `;
  if (name.toLowerCase().startsWith(prefix.toLowerCase()) && name.length > prefix.length) {
    return name.slice(prefix.length);
  }
  return name;
};

export const statusText = (entity) => {
  if (isUnavailable(entity)) return 'Unavailable';
  if (!isOn(entity)) return 'Off';
  const pct = supportsBrightness(entity) ? brightnessPct(entity) : null;
  return pct === null ? 'On' : `On · ${pct}%`;
};
