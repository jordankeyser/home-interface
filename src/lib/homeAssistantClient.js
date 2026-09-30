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
 */
export function connectHomeAssistant(baseUrl, token, handlers) {
  let ws = null;
  let nextId = 1;
  const pending = new Map();
  let closedByCaller = false;
  let reconnectTimer = null;
  let registryTimer = null;
  let reconnectDelay = 1000;

  const send = (msg) =>
    new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to Home Assistant'));
        return;
      }
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ ...msg, id }));
    });

  const loadLayout = async () => {
    const [areas, devices, display] = await Promise.all([
      send({ type: 'config/area_registry/list' }),
      send({ type: 'config/device_registry/list' }),
      send({ type: 'config/entity_registry/list_for_display' }),
    ]);
    handlers.onLayout?.(buildLayout(areas, devices, display));
  };

  const scheduleLayoutRefresh = () => {
    clearTimeout(registryTimer);
    registryTimer = setTimeout(() => {
      loadLayout().catch((err) => console.error('[ha] layout refresh failed:', err.message));
    }, REGISTRY_REFRESH_MS);
  };

  const onReady = async () => {
    try {
      // Subscribe before the snapshot so nothing that changes in between is
      // lost; the snapshot is newer than any event that beats it here.
      await send({ type: 'subscribe_events', event_type: 'state_changed' });
      await Promise.all(
        REGISTRY_EVENTS.map((event_type) => send({ type: 'subscribe_events', event_type }))
      );
      // Rooms are a nicety: if the registries can't be read (a non-admin
      // token, say) the devices still show, just ungrouped.
      const [states] = await Promise.all([
        send({ type: 'get_states' }),
        loadLayout().catch((err) => console.warn('[ha] no room layout:', err.message)),
      ]);
      handlers.onStates?.(
        new Map(states.filter((s) => handlers.filter(s.entity_id)).map((s) => [s.entity_id, s]))
      );
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
    ws = new WebSocket(wsUrl);
    let authFailed = false;

    ws.onmessage = (event) => {
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
          if (msg.success) p.resolve(msg.result);
          else p.reject(new Error(msg.error?.message || 'Home Assistant request failed'));
          return;
        }

        case 'event': {
          const { event_type: type, data } = msg.event || {};
          if (type === 'state_changed') {
            if (data?.entity_id && handlers.filter(data.entity_id)) {
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

    ws.onclose = () => {
      pending.forEach((p) => p.reject(new Error('Connection closed')));
      pending.clear();
      clearTimeout(registryTimer);
      if (closedByCaller || authFailed) return;
      handlers.onStatus?.('closed');
      reconnectTimer = setTimeout(open, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    };

    ws.onerror = () => {
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
      clearTimeout(registryTimer);
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
