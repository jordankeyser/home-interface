import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from './useSettings';
import { useDisplay } from './useDisplay';
import { connectHomeAssistant } from '../lib/homeAssistantClient';
import { findVacuum, isVacuumRelated, mappedRooms } from '../lib/vacuum';

/** How long a tapped setting shows its new value while waiting for Home Assistant. */
const OVERRIDE_MS = 8000;
const ERROR_MS = 5000;

const EMPTY = new Map();

const blank = (key) => ({
  key,
  status: 'connecting',
  loaded: false,
  states: EMPTY,
  layout: null,
  entry: undefined,
});

const firstVacuumId = (states) =>
  [...states.keys()].filter((id) => id.startsWith('vacuum.')).sort()[0] ?? null;

/**
 * The robot vacuum, live from Home Assistant.
 *
 * Its own connection, separate from the lights page's: that keeps the lights
 * code untouched and lets this one subscribe to the select and sensor domains
 * the vacuum's settings live in. Like the lights, it's open while the panel is
 * awake and closed while it sleeps.
 *
 * Roborock settings and room cleaning go through Roborock's cloud, which bans
 * clients that hammer it, so the page only sends commands when tapped and
 * never polls the robot itself; Home Assistant's own 30 s polling feeds it.
 */
export const useVacuum = () => {
  const { settings } = useSettings();
  const { isAsleep } = useDisplay();
  const url = (settings.haUrl || '').trim();
  const token = (settings.haToken || '').trim();
  const configured = Boolean(url && token);
  const connKey = `${url}\n${token}`;

  const [data, setData] = useState(() => blank(null));
  const [overrides, setOverrides] = useState(EMPTY);
  const [actionError, setActionError] = useState(null);
  const [sending, setSending] = useState(null);

  const clientRef = useRef(null);
  const overrideTimers = useRef(new Map());
  const errorTimer = useRef(null);

  useEffect(() => {
    if (!configured || isAsleep) return undefined;

    const update = (fn) =>
      setData((prev) => fn(prev.key === connKey ? prev : blank(connKey)));

    let latestStates = EMPTY;
    let client = null;

    // The room mapping is in the vacuum's full registry entry, which the
    // display registry doesn't include. It's a local registry read, so it's
    // cheap to refresh after every sync.
    const loadEntry = async () => {
      const vacuumId = firstVacuumId(latestStates);
      if (!vacuumId || !client) return;
      try {
        const entries = await client.request({
          type: 'config/entity_registry/get_entries',
          entity_ids: [vacuumId],
        });
        update((d) => ({ ...d, entry: entries?.[vacuumId] ?? null }));
      } catch (err) {
        console.warn('[vacuum] no registry entry:', err.message);
        update((d) => ({ ...d, entry: d.entry ?? null }));
      }
    };

    client = connectHomeAssistant(url, token, {
      filter: isVacuumRelated,
      onStatus: (status) => update((d) => ({ ...d, status })),
      onStates: (states) => {
        latestStates = states;
        update((d) => ({ ...d, states, loaded: true }));
      },
      onLayout: (layout) => update((d) => ({ ...d, layout })),
      onSync: loadEntry,
      onStateChanged: (entityId, newState) => {
        const states = new Map(latestStates);
        if (newState) states.set(entityId, newState);
        else states.delete(entityId);
        latestStates = states;
        update((d) => ({ ...d, states }));
        // Home Assistant reported the value that was tapped: stop overriding.
        setOverrides((prev) => {
          const ov = prev.get(entityId);
          if (!ov || !newState) return prev;
          const confirmed =
            ov.state !== undefined
              ? newState.state === ov.state
              : newState.attributes?.fan_speed === ov.fanSpeed;
          if (!confirmed) return prev;
          const next = new Map(prev);
          next.delete(entityId);
          return next;
        });
      },
    });
    clientRef.current = client;

    return () => {
      client.close();
      clientRef.current = null;
    };
  }, [configured, isAsleep, url, token, connKey]);

  useEffect(() => {
    const timers = overrideTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(errorTimer.current);
    };
  }, []);

  const clearOverride = useCallback((entityId) => {
    clearTimeout(overrideTimers.current.get(entityId));
    overrideTimers.current.delete(entityId);
    setOverrides((prev) => {
      if (!prev.has(entityId)) return prev;
      const next = new Map(prev);
      next.delete(entityId);
      return next;
    });
  }, []);

  const setOverride = useCallback(
    (entityId, ov) => {
      clearTimeout(overrideTimers.current.get(entityId));
      overrideTimers.current.set(
        entityId,
        setTimeout(() => clearOverride(entityId), OVERRIDE_MS)
      );
      setOverrides((prev) => new Map(prev).set(entityId, ov));
    },
    [clearOverride]
  );

  const flashError = useCallback((message) => {
    clearTimeout(errorTimer.current);
    setActionError(message);
    errorTimer.current = setTimeout(() => setActionError(null), ERROR_MS);
  }, []);

  /** `what` names the button that's waiting, so it can show it's working. */
  const run = useCallback(
    async (what, domain, service, serviceData, failMessage, optimistic) => {
      if (optimistic) setOverride(...optimistic);
      setSending(what);
      try {
        if (!clientRef.current) throw new Error('Not connected to Home Assistant');
        await clientRef.current.callService(domain, service, serviceData);
      } catch (err) {
        console.error(`[vacuum] ${domain}.${service} failed:`, err.message);
        if (optimistic) clearOverride(optimistic[0]);
        flashError(err.message ? `${failMessage}: ${err.message}` : failMessage);
      } finally {
        setSending((current) => (current === what ? null : current));
      }
    },
    [setOverride, clearOverride, flashError]
  );

  const current = data.key === connKey ? data : blank(connKey);
  const { states, layout, entry } = current;

  const device = useMemo(() => {
    const found = findVacuum(states, layout);
    if (!found) return null;
    const withOverride = (entity) => {
      const ov = entity && overrides.get(entity.entity_id);
      if (!ov) return entity;
      return ov.state !== undefined
        ? { ...entity, state: ov.state }
        : { ...entity, attributes: { ...entity.attributes, fan_speed: ov.fanSpeed } };
    };
    return {
      ...found,
      vacuum: withOverride(found.vacuum),
      mode: withOverride(found.mode),
      water: withOverride(found.water),
      passes: withOverride(found.passes),
    };
  }, [states, layout, overrides]);

  const rooms = useMemo(
    () => (entry === undefined ? undefined : mappedRooms(entry, layout?.areas || [])),
    [entry, layout]
  );

  const vacuumId = device?.vacuum.entity_id;

  const actions = useMemo(
    () => ({
      cleanAll: () =>
        run('clean', 'vacuum', 'start', { entity_id: vacuumId }, 'Couldn’t start cleaning'),
      cleanRooms: (areaIds) =>
        run(
          'clean',
          'vacuum',
          'clean_area',
          { entity_id: vacuumId, cleaning_area_id: areaIds },
          'Couldn’t start cleaning those rooms'
        ),
      pause: () => run('pause', 'vacuum', 'pause', { entity_id: vacuumId }, 'Couldn’t pause'),
      resume: () => run('pause', 'vacuum', 'start', { entity_id: vacuumId }, 'Couldn’t resume'),
      dock: () =>
        run('dock', 'vacuum', 'return_to_base', { entity_id: vacuumId }, 'Couldn’t send it home'),
      locate: () =>
        run('locate', 'vacuum', 'locate', { entity_id: vacuumId }, 'Couldn’t find the vacuum'),
      setFanSpeed: (fanSpeed) =>
        run(
          'fan',
          'vacuum',
          'set_fan_speed',
          { entity_id: vacuumId, fan_speed: fanSpeed },
          'Couldn’t change suction',
          [vacuumId, { fanSpeed }]
        ),
      select: (entity, option) =>
        run(
          entity.entity_id,
          'select',
          'select_option',
          { entity_id: entity.entity_id, option },
          'Couldn’t change that setting',
          [entity.entity_id, { state: option }]
        ),
    }),
    [run, vacuumId]
  );

  const status = !configured ? 'unconfigured' : isAsleep ? 'paused' : current.status;

  return {
    url,
    status,
    loaded: current.loaded,
    device,
    /** Mapped rooms; `null` when no mapping is set up, `undefined` while loading. */
    rooms,
    stale: current.loaded && (status === 'closed' || status === 'invalid_url'),
    actionError,
    sending,
    actions,
  };
};
