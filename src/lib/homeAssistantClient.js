/**
 * Minimal client for Home Assistant's WebSocket API.
 *
 * One connection handles everything — initial state, live updates, the room
 * (area) layout, and commands — rather than mixing REST polling with a
 * separate stream. Kept deliberately small (no `home-assistant-js-websocket`
 * dependency): the panel needs a handful of commands, and a focused client is
 * easier to reason about on a Pi than a general-purpose library.
 *
 * Protocol (developers.home-assistant.io/docs/api/websocket):
 *   server -> {type:"auth_required"}
 *   client -> {type:"auth", access_token}
 *   server -> {type:"auth_ok"} | {type:"auth_invalid", message}
 *   client -> {id, type:"get_states"}                                  -> result
 *   client -> {id, type:"subscribe_events", event_type}                -> result, then repeated {type:"event", event}
 *   client -> {id, type:"call_service", domain, service, service_data} -> result
 *   client -> {id, type:"config/area_registry/list" | "config/device_registry/list"
 *                      | "config/entity_registry/list_for_display"}     -> result
 */

const REGISTRY_EVENTS = [
  'area_registry_updated',
  'device_registry_updated',
  'entity_registry_updated',
];

/** Bursts of registry edits (renaming a room, re-pairing a bulb) land as one refetch. */
const REGISTRY_REFRESH_MS = 750;
/** Safety net for integrations that add/remove entities without a registry event reaching us. */
const STATE_RECONCILE_MS = 60_000;
/** Chromium can leave a WebSocket in CONNECTING forever during the Pi boot race. */
const CONNECT_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;

const httpToWs = (url) => {
  const u = new URL(url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Not an http(s) URL');
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/api/websocket';
  u.search = '';
  u.hash = '';
  return u.toString();
};

/**
 * Turns the three registries into what the panel needs: the rooms, and which
 * room each entity is in. An entity inherits its device's room unless it has
 * been moved on its own. Hidden entities and config/diagnostic ones (firmware
 * switches, identify buttons) are left out, as Home Assistant's own dashboards
 * do.
 */
const buildLayout = (areas, devices, display) => {
  const deviceArea = new Map(devices.map((d) => [d.id, d.area_id]));
  const entities = new Map();
  (display?.entities || []).forEach((e) => {
    entities.set(e.ei, {
      areaId: e.ai ?? deviceArea.get(e.di) ?? null,
      hidden: Boolean(e.hb) || e.ec !== undefined,
    });
  });

  return {
    areas: areas
      .map((a) => ({ id: a.area_id, name: a.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    entities,
  };
};

/**
 * @param {string} baseUrl e.g. "http://127.0.0.1:8123"
 * @param {string} token long-lived access token
 * @param {{
 *   filter: (entityId: string) => boolean,
 *   onStates: (states: Map<string, object>) => void,
 *   onStateChanged: (entityId: string, newState: object | null) => void,
 *   onLayout: (layout: {areas: {id: string, name: string}[], entities: Map<string, {areaId: string|null, hidden: boolean}>}) => void,
 *   onStatus: (status: 'connecting'|'open'|'closed'|'auth_failed'|'invalid_url') => void,
 * }} handlers
 * @param {{reconcileMs?: number, registryRefreshMs?: number, connectTimeoutMs?: number, requestTimeoutMs?: number}} options
 */
export function connectHomeAssistant(baseUrl, token, handlers, options = {}) {
  const reconcileMs = options.reconcileMs ?? STATE_RECONCILE_MS;
  const registryRefreshMs = options.registryRefreshMs ?? REGISTRY_REFRESH_MS;
  const connectTimeoutMs = options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  let ws = null;
  let nextId = 1;
  const pending = new Map();
  let closedByCaller = false;
  let reconnectTimer = null;
  let connectTimer = null;
  let registryTimer = null;
  let reconcileTimer = null;
  let reconnectDelay = 1000;
  let syncPromise = null;
  let currentStates = new Map();
  let currentLayout = null;

  const scheduleReconnect = () => {
    if (closedByCaller || reconnectTimer) return;
    handlers.onStatus?.('closed');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
  };

  const send = (msg) =>
    new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to Home Assistant'));
        return;
      }
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Home Assistant did not answer ${msg.type}`));
        // A request timing out means the socket may be half-open. Closing it
        // activates the normal reconnect path and fetches a fresh snapshot.
        ws?.close();
      }, requestTimeoutMs);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ ...msg, id }));
    });

  const statesMatch = (next) => {
    if (next.size !== currentStates.size) return false;
    for (const [id, entity] of next) {
      const previous = currentStates.get(id);
      if (
        !previous ||
        previous.state !== entity.state ||
        previous.last_updated !== entity.last_updated
      ) {
        return false;
      }
    }
    return true;
  };

  const publishStates = (states) => {
    const next = new Map(
      states.filter((state) => handlers.filter(state.entity_id)).map((state) => [state.entity_id, state])
    );
    if (statesMatch(next)) return;
    currentStates = next;
    handlers.onStates?.(next);
  };

  const layoutsMatch = (next) => {
    if (!currentLayout || next.areas.length !== currentLayout.areas.length) return false;
    if (next.entities.size !== currentLayout.entities.size) return false;
    for (let index = 0; index < next.areas.length; index += 1) {
      const area = next.areas[index];
      const previous = currentLayout.areas[index];
      if (area.id !== previous.id || area.name !== previous.name) return false;
    }
    for (const [id, meta] of next.entities) {
      const previous = currentLayout.entities.get(id);
      if (!previous || meta.areaId !== previous.areaId || meta.hidden !== previous.hidden) {
        return false;
      }
    }
    return true;
  };

  const loadLayout = async () => {
    const [areas, devices, display] = await Promise.all([
      send({ type: 'config/area_registry/list' }),
      send({ type: 'config/device_registry/list' }),
      send({ type: 'config/entity_registry/list_for_display' }),
    ]);
    const next = buildLayout(areas, devices, display);
    if (layoutsMatch(next)) return;
    currentLayout = next;
    handlers.onLayout?.(next);
  };

  const reconcile = () => {
    if (syncPromise) return syncPromise;
    syncPromise = Promise.all([
      send({ type: 'get_states' }).then(publishStates),
      // Rooms are a nicety: if the registries can't be read (a non-admin
      // token, say) the devices still show, just ungrouped.
      loadLayout().catch((err) => console.warn('[ha] no room layout:', err.message)),
    ]).finally(() => {
      syncPromise = null;
    });
    return syncPromise;
  };

  const scheduleReconcile = () => {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(async () => {
      try {
        await reconcile();
      } catch (err) {
        console.error('[ha] periodic sync failed:', err.message);
      } finally {
        if (!closedByCaller && ws?.readyState === WebSocket.OPEN) scheduleReconcile();
      }
    }, reconcileMs);
  };

  const scheduleLayoutRefresh = () => {
    clearTimeout(registryTimer);
    registryTimer = setTimeout(() => {
      reconcile().catch((err) => console.error('[ha] registry sync failed:', err.message));
    }, registryRefreshMs);
  };

  const onReady = async () => {
    try {
      // Subscribe before the snapshot so nothing that changes in between is
      // lost; the snapshot is newer than any event that beats it here.
      await send({ type: 'subscribe_events', event_type: 'state_changed' });
      await Promise.all(
        REGISTRY_EVENTS.map((event_type) => send({ type: 'subscribe_events', event_type }))
      );
      await reconcile();
      scheduleReconcile();
    } catch (err) {
      console.error('[ha] initial load failed:', err.message);
    }
  };

  const open = () => {
    let wsUrl;
    try {
      wsUrl = httpToWs(baseUrl);
    } catch {
      handlers.onStatus?.('invalid_url');
      return;
    }

    handlers.onStatus?.('connecting');
    let authFailed = false;
    let socket;

    try {
      socket = new WebSocket(wsUrl);
      ws = socket;
    } catch {
      scheduleReconnect();
      return;
    }

    // On this Pi, Chromium has occasionally kept a boot-time connection in
    // CONNECTING indefinitely even after Home Assistant was ready. No close
    // event means the normal retry path never runs, leaving the page spinning
    // forever. Abort that handshake and let the existing backoff reconnect.
    clearTimeout(connectTimer);
    connectTimer = setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        socket.close();
        // Some Chromium hangs also fail to deliver `close`; do not depend on
        // that event to escape the permanent loading screen.
        scheduleReconnect();
      }
    }, connectTimeoutMs);

    socket.onopen = () => {
      clearTimeout(connectTimer);
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'auth_required':
          ws.send(JSON.stringify({ type: 'auth', access_token: token }));
          return;

        case 'auth_invalid':
          // Retrying a rejected token just piles up failed logins (and trips
          // Home Assistant's IP ban if it's enabled). Stay down until the
          // token changes, which creates a new client.
          authFailed = true;
          handlers.onStatus?.('auth_failed');
          ws.close();
          return;

        case 'auth_ok':
          reconnectDelay = 1000;
          handlers.onStatus?.('open');
          onReady();
          return;

        case 'result': {
          const p = pending.get(msg.id);
          if (!p) return;
          pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.success) p.resolve(msg.result);
          else p.reject(new Error(msg.error?.message || 'Home Assistant request failed'));
          return;
        }

        case 'event': {
          const { event_type: type, data } = msg.event || {};
          if (type === 'state_changed') {
            if (data?.entity_id && handlers.filter(data.entity_id)) {
              const next = new Map(currentStates);
              if (data.new_state) next.set(data.entity_id, data.new_state);
              else next.delete(data.entity_id);
              currentStates = next;
              handlers.onStateChanged?.(data.entity_id, data.new_state);
            }
          } else if (REGISTRY_EVENTS.includes(type)) {
            scheduleLayoutRefresh();
          }
          return;
        }

        default:
      }
    };

    socket.onclose = () => {
      // A timed-out socket can report its close after its replacement opens.
      // It must not tear down requests belonging to the new connection.
      if (ws !== socket) return;
      clearTimeout(connectTimer);
      pending.forEach((p) => {
        clearTimeout(p.timer);
        p.reject(new Error('Connection closed'));
      });
      pending.clear();
      clearTimeout(registryTimer);
      clearTimeout(reconcileTimer);
      syncPromise = null;
      if (closedByCaller || authFailed) return;
      scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose fires right after; the reconnect logic lives there.
    };
  };

  open();

  return {
    /** @param {string} domain @param {string} service @param {object} serviceData */
    callService(domain, service, serviceData) {
      return send({ type: 'call_service', domain, service, service_data: serviceData });
    },

    close() {
      closedByCaller = true;
      clearTimeout(reconnectTimer);
      clearTimeout(connectTimer);
      clearTimeout(registryTimer);
      clearTimeout(reconcileTimer);
      pending.forEach((p) => clearTimeout(p.timer));
      ws?.close();
    },
  };
}

/**
 * One-shot check for the Settings screen: can we reach this Home Assistant
 * with this token, and how many devices would the panel show?
 *
 * @returns {Promise<{ok: true, count: number} | {ok: false, reason: string}>}
 */
export function testHomeAssistant(baseUrl, token, { filter, timeoutMs = 8000 }) {
  return new Promise((resolve) => {
    let done = false;
    let client = null;

    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      client?.close();
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ ok: false, reason: `No answer from ${baseUrl}` }),
      timeoutMs
    );

    client = connectHomeAssistant(baseUrl, token, {
      filter,
      onStates: (states) => finish({ ok: true, count: states.size }),
      onStatus: (status) => {
        if (status === 'invalid_url') {
          finish({ ok: false, reason: 'That URL isn’t valid — include http://' });
        } else if (status === 'auth_failed') {
          finish({ ok: false, reason: 'Home Assistant rejected the token' });
        } else if (status === 'closed') {
          finish({ ok: false, reason: `Couldn’t reach ${baseUrl}` });
        }
      },
    });

    // `invalid_url` is reported synchronously, before `client` is assigned.
    if (done) client.close();
  });
}
