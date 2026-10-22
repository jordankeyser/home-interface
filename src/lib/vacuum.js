/**
 * Reading a robot vacuum out of Home Assistant.
 *
 * Written against the Roborock integration (a Q7 L5 here), whose vacuum entity
 * only covers start/pause/dock and suction. Everything else is a companion
 * entity on the same device: a "Cleaning mode" select (vacuum, mop or both),
 * "Water flow", "Cleaning cycles", a status sensor and a battery sensor. They
 * are found by device and translation key, not by entity id, so renaming the
 * vacuum in Home Assistant doesn't break the page. A control whose entity is
 * missing is simply not shown, so other Roborock models degrade gracefully.
 *
 * Rooms come from Home Assistant's "clean by area" mapping, stored in the
 * vacuum's entity-registry options as `vacuum.area_mapping`
 * ({area_id: [segment ids]}). `vacuum.clean_area` cleans by area id.
 */

/** State domains the vacuum page subscribes to. */
export const VACUUM_DOMAINS = new Set(['vacuum', 'select', 'sensor']);

const domainOf = (entityId) => entityId.slice(0, entityId.indexOf('.'));

export const isVacuumRelated = (entityId) => VACUUM_DOMAINS.has(domainOf(entityId));

/** Companion selects, by translation key; the first key present wins. */
const SELECT_KEYS = {
  mode: ['cleaning_mode'],
  water: ['water_flow', 'mop_intensity'],
  passes: ['cleaning_cycles'],
};

const STATUS_KEYS = ['q7_status', 'status'];

/**
 * @param {Map<string, object>} states
 * @param {{entities: Map<string, {deviceId: string|null, translationKey: string|null}>} | null} layout
 */
export const findVacuum = (states, layout) => {
  const vacuums = [...states.values()]
    .filter((s) => domainOf(s.entity_id) === 'vacuum')
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  const vacuum = vacuums[0];
  if (!vacuum) return null;

  const deviceId = layout?.entities.get(vacuum.entity_id)?.deviceId ?? null;
  const siblings = deviceId
    ? [...states.values()].filter(
        (s) => s !== vacuum && layout.entities.get(s.entity_id)?.deviceId === deviceId
      )
    : [];
  const byKey = (domain, keys) => {
    for (const key of keys) {
      const hit = siblings.find(
        (s) =>
          domainOf(s.entity_id) === domain &&
          layout.entities.get(s.entity_id)?.translationKey === key
      );
      if (hit) return hit;
    }
    return null;
  };

  return {
    vacuum,
    mode: byKey('select', SELECT_KEYS.mode),
    water: byKey('select', SELECT_KEYS.water),
    passes: byKey('select', SELECT_KEYS.passes),
    status: byKey('sensor', STATUS_KEYS),
    battery:
      siblings.find(
        (s) => domainOf(s.entity_id) === 'sensor' && s.attributes?.device_class === 'battery'
      ) ?? null,
  };
};

export const isAvailable = (entity) =>
  Boolean(entity) && entity.state !== 'unavailable' && entity.state !== 'unknown';

/** Home Assistant's vacuum activities. */
export const ACTIVITY = {
  cleaning: 'Cleaning',
  docked: 'Docked',
  idle: 'Ready',
  paused: 'Paused',
  returning: 'Returning to dock',
  error: 'Needs attention',
  unavailable: 'Unavailable',
};

/** The Q7's own, more specific status, when its status sensor is present. */
const STATUS_LABELS = {
  sleeping: 'Asleep',
  waiting_for_orders: 'Ready',
  paused: 'Paused',
  working_sleep: 'Paused',
  docking: 'Returning to dock',
  charging: 'Charging',
  // Reported for any cleaning run, mop-only included, so it can't be more specific.
  sweep_moping: 'Cleaning',
  sweep_moping_2: 'Cleaning',
  moping: 'Mopping',
  updating: 'Updating firmware',
  mop_cleaning: 'Washing the mop',
  mop_airdrying: 'Drying the mop',
};

export const statusLabel = (vacuum, status) => {
  if (!isAvailable(vacuum)) return ACTIVITY.unavailable;
  if (vacuum.state === 'error') return ACTIVITY.error;
  return STATUS_LABELS[status?.state] ?? ACTIVITY[vacuum.state] ?? vacuum.state;
};

export const isBusy = (vacuum) => vacuum?.state === 'cleaning' || vacuum?.state === 'returning';

/** Labels for option values, falling back to a tidied-up raw value. */
const OPTION_LABELS = {
  // cleaning mode
  vacuum: 'Vacuum',
  vac_and_mop: 'Vacuum + mop',
  mop: 'Mop',
  // suction
  quiet: 'Quiet',
  silent: 'Silent',
  balanced: 'Balanced',
  standard: 'Standard',
  turbo: 'Turbo',
  max: 'Max',
  max_plus: 'Max+',
  // water flow / mop intensity
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  mild: 'Mild',
  moderate: 'Moderate',
  intense: 'Intense',
  // passes
  one: 'Once',
  two: 'Twice',
};

export const optionLabel = (value) =>
  OPTION_LABELS[value] ??
  String(value)
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

/** Mode order on screen, whatever order the integration lists them in. */
const MODE_ORDER = ['vacuum', 'vac_and_mop', 'mop'];

export const modeOptions = (select) => {
  const options = select?.attributes?.options || [];
  const known = MODE_ORDER.filter((o) => options.includes(o));
  return [...known, ...options.filter((o) => !MODE_ORDER.includes(o))];
};

/** "custom" (set per room in the Roborock app) and "off" aren't useful from the wall. */
const HIDDEN_OPTIONS = new Set(['custom', 'custom_water_flow', 'smart_mode', 'off']);

export const plainOptions = (list) => (list || []).filter((o) => !HIDDEN_OPTIONS.has(o));

/** Whether the current mode involves the brush, the mop, or both. */
export const usesSuction = (mode) => mode !== 'mop';
export const usesWater = (mode) => mode !== 'vacuum';

/**
 * Rooms the vacuum can clean: the Home Assistant areas mapped to its map
 * segments, in the area registry's (alphabetical) order. `null` means no
 * mapping has been set up yet.
 *
 * @param {object|null} entry full entity-registry entry for the vacuum
 * @param {{id: string, name: string}[]} areas
 */
export const mappedRooms = (entry, areas) => {
  const mapping = entry?.options?.vacuum?.area_mapping;
  if (!mapping || typeof mapping !== 'object') return null;
  const mapped = new Set(
    Object.entries(mapping)
      .filter(([, segments]) => Array.isArray(segments) && segments.length > 0)
      .map(([areaId]) => areaId)
  );
  return areas.filter((a) => mapped.has(a.id));
};
