import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from './useSettings';
import { useDisplay } from './useDisplay';
import { connectHomeAssistant } from '../lib/homeAssistantClient';
import { domainOf, friendlyName, isOn, isSupported } from '../lib/haEntities';

/** How long a tapped tile shows its new state while waiting for Home Assistant to confirm it. */
const OVERRIDE_MS = 6000;
const ERROR_MS = 4000;

const EMPTY = new Map();

const blank = (key) => ({ key, status: 'connecting', loaded: false, states: EMPTY, layout: null });

const applyOverride = (entity, ov) => ({
  ...entity,
  state: ov.state,
  attributes:
    ov.brightness === undefined
      ? entity.attributes
      : { ...entity.attributes, brightness: ov.brightness },
});

/**
 * Live device state from Home Assistant, grouped by room.
 *
 * The connection stays open while the panel is awake — not just while the
 * devices page is showing — so swiping over never waits on a handshake. It
 * closes while the panel sleeps, like the other modules' polling, and waking
 * fetches a fresh snapshot.
 */
export const useHomeAssistant = () => {
  const { settings } = useSettings();
  const { isAsleep } = useDisplay();
  const url = (settings.haUrl || '').trim();
  const token = (settings.haToken || '').trim();
  const configured = Boolean(url && token);
  const connKey = `${url}\n${token}`;

  // Tagged with the connection it came from, so changing the server or token
  // in Settings never shows the previous server's devices — and needs no
  // reset-in-an-effect to guarantee it.
  const [data, setData] = useState(() => blank(null));
  const [overrides, setOverrides] = useState(EMPTY);
  const [actionError, setActionError] = useState(null);

  const clientRef = useRef(null);
  const overrideTimers = useRef(new Map());
  const errorTimer = useRef(null);

  useEffect(() => {
    if (!configured || isAsleep) return undefined;

    const update = (fn) =>
      setData((prev) => fn(prev.key === connKey ? prev : blank(connKey)));

    const client = connectHomeAssistant(url, token, {
      filter: isSupported,
      onStatus: (status) => update((d) => ({ ...d, status })),
      onStates: (states) => update((d) => ({ ...d, states, loaded: true })),
      onLayout: (layout) => update((d) => ({ ...d, layout })),
      onStateChanged: (entityId, newState) => {
        update((d) => {
          const states = new Map(d.states);
          if (newState) states.set(entityId, newState);
          else states.delete(entityId);
          return { ...d, states };
        });
        // Home Assistant caught up with the tap: drop the optimistic state.
        setOverrides((prev) => {
          const ov = prev.get(entityId);
          if (!ov || (newState && newState.state !== ov.state)) return prev;
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

  /** Calls a service, showing `optimistic` states until HA confirms or it fails. */
  const run = useCallback(
    async (domain, service, serviceData, optimistic, failMessage) => {
      optimistic.forEach(([id, ov]) => setOverride(id, ov));
      try {
        if (!clientRef.current) throw new Error('Not connected to Home Assistant');
        await clientRef.current.callService(domain, service, serviceData);
      } catch (err) {
        console.error(`[ha] ${domain}.${service} failed:`, err.message);
        optimistic.forEach(([id]) => clearOverride(id));
        flashError(failMessage);
      }
    },
    [setOverride, clearOverride, flashError]
  );

  const toggle = useCallback(
    (entity) => {
      const id = entity.entity_id;
      const next = isOn(entity) ? 'off' : 'on';
      return run(
        domainOf(id),
        next === 'on' ? 'turn_on' : 'turn_off',
        { entity_id: id },
        [[id, { state: next }]],
        `Couldn’t switch ${friendlyName(entity)} ${next}`
      );
    },
    [run]
  );

  const setBrightness = useCallback(
    (entity, pct) => {
      const id = entity.entity_id;
      if (pct <= 0) {
        return run('light', 'turn_off', { entity_id: id }, [[id, { state: 'off' }]],
          `Couldn’t turn off ${friendlyName(entity)}`);
      }
      return run(
        'light',
        'turn_on',
        { entity_id: id, brightness_pct: Math.round(pct) },
        [[id, { state: 'on', brightness: Math.round((pct / 100) * 255) }]],
        `Couldn’t dim ${friendlyName(entity)}`
      );
    },
    [run]
  );

  /** Everything in the list that's on, off — one call, any mix of domains. */
  const turnOff = useCallback(
    (entities) => {
      const ids = entities.filter(isOn).map((e) => e.entity_id);
      if (ids.length === 0) return undefined;
      return run(
        'homeassistant',
        'turn_off',
        { entity_id: ids },
        ids.map((id) => [id, { state: 'off' }]),
        'Couldn’t turn everything off'
      );
    },
    [run]
  );

  const current = data.key === connKey ? data : blank(connKey);
  const { states, layout } = current;

  const groups = useMemo(() => {
    const areaNames = new Map((layout?.areas || []).map((a) => [a.id, a.name]));
    const byArea = new Map();

    states.forEach((raw) => {
      const meta = layout?.entities.get(raw.entity_id);
      if (meta?.hidden) return;
      const ov = overrides.get(raw.entity_id);
      const entity = ov ? applyOverride(raw, ov) : raw;
      const areaId = meta?.areaId && areaNames.has(meta.areaId) ? meta.areaId : null;
      if (!byArea.has(areaId)) byArea.set(areaId, []);
      byArea.get(areaId).push(entity);
    });

    const byName = (a, b) => friendlyName(a).localeCompare(friendlyName(b));
    const ordered = (layout?.areas || [])
      .filter((a) => byArea.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, entities: byArea.get(a.id).sort(byName) }));

    if (byArea.has(null)) {
      ordered.push({
        id: null,
        // With no rooms set up at all, a lone "Other" heading is just noise.
        name: ordered.length > 0 ? 'Other' : null,
        entities: byArea.get(null).sort(byName),
      });
    }
    return ordered;
  }, [states, layout, overrides]);

  const status = !configured ? 'unconfigured' : isAsleep ? 'paused' : current.status;

  return {
    url,
    configured,
    status,
    loaded: current.loaded,
    groups,
    /** Showing the last known states because the connection is down. */
    stale: current.loaded && (status === 'closed' || status === 'invalid_url'),
    actionError,
    toggle,
    setBrightness,
    turnOff,
  };
};
