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

/** Support both modern color modes and older supported-feature reporting. */
export const supportsBrightness = (entity) =>
  domainOf(entity.entity_id) === 'light' &&
  ((entity.attributes?.supported_color_modes || []).some((m) => m !== 'onoff') ||
    typeof entity.attributes?.brightness === 'number' ||
    (Number(entity.attributes?.supported_features || 0) & 1) === 1);

/** HA stores brightness as 0–255; people think in percent. */
export const brightnessPct = (entity) => {
  const b = entity.attributes?.brightness;
  return typeof b === 'number' ? Math.max(1, Math.round((b / 255) * 100)) : null;
};

const COLOR_MODES = new Set(['hs', 'xy', 'rgb', 'rgbw', 'rgbww']);

const colorModes = (entity) =>
  domainOf(entity.entity_id) === 'light' ? entity.attributes?.supported_color_modes || [] : [];

/** Any full-color mode; Home Assistant accepts `hs_color` for all of them. */
export const supportsColor = (entity) => colorModes(entity).some((m) => COLOR_MODES.has(m));

export const supportsColorTemp = (entity) => colorModes(entity).includes('color_temp');

export const kelvinRange = (entity) => [
  entity.attributes?.min_color_temp_kelvin ?? 2000,
  entity.attributes?.max_color_temp_kelvin ?? 6500,
];

/** The bulb's current color as CSS, or null when it doesn't report one. */
export const lightColor = (entity) => {
  const rgb = entity.attributes?.rgb_color;
  return Array.isArray(rgb) && rgb.length === 3 ? `rgb(${rgb.join(' ')})` : null;
};

/** Hue 0–360, saturation 0–100, at full value — for swatches and optimistic display. */
export const hsToRgb = ([h, s]) => {
  const sat = s / 100;
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (1 - sat * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
};

/** Approximate color of a white at `kelvin` (Tanner Helland's fit). */
export const kelvinToRgb = (kelvin) => {
  const t = kelvin / 100;
  const c = (n) => Math.round(Math.min(255, Math.max(0, n)));
  const r = t <= 66 ? 255 : 329.7 * (t - 60) ** -0.1332;
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * (t - 60) ** -0.0755;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  return [c(r), c(g), c(b)];
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
