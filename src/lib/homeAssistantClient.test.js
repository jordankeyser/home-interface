import test from 'node:test';
import assert from 'node:assert/strict';
import { connectHomeAssistant } from './homeAssistantClient.js';

const entity = (id, state = 'off', version = 1) => ({
  entity_id: id,
  state,
  last_updated: `2026-10-04T12:00:0${version}.000Z`,
  attributes: { friendly_name: id.split('.')[1] },
});

const waitFor = async (condition, timeoutMs = 500) => {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

test('new entities reconcile after registry events and periodic safety checks', async (t) => {
  const originalWebSocket = globalThis.WebSocket;
  let snapshot = [entity('light.desk')];

  class FakeWebSocket {
    static OPEN = 1;
    static instances = [];

    constructor() {
      this.readyState = FakeWebSocket.OPEN;
      FakeWebSocket.instances.push(this);
    }

    send(payload) {
      const message = JSON.parse(payload);
      if (message.type === 'auth') return;

      let result = null;
      if (message.type === 'get_states') result = snapshot;
      if (message.type === 'config/area_registry/list') result = [];
      if (message.type === 'config/device_registry/list') result = [];
      if (message.type === 'config/entity_registry/list_for_display') {
        result = { entities: snapshot.map((item) => ({ ei: item.entity_id })) };
      }

      queueMicrotask(() =>
        this.emit({ type: 'result', id: message.id, success: true, result })
      );
    }

    emit(message) {
      this.onmessage?.({ data: JSON.stringify(message) });
    }

    close() {
      if (this.readyState !== FakeWebSocket.OPEN) return;
      this.readyState = 3;
      queueMicrotask(() => this.onclose?.());
    }
  }

  globalThis.WebSocket = FakeWebSocket;
  t.after(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  const published = [];
  const client = connectHomeAssistant(
    'http://homeassistant.local:8123',
    'token',
    {
      filter: (id) => id.startsWith('light.'),
      onStates: (states) => published.push(states),
    },
    { reconcileMs: 25, registryRefreshMs: 5, requestTimeoutMs: 100 }
  );
  t.after(() => client.close());

  const socket = FakeWebSocket.instances[0];
  socket.emit({ type: 'auth_required' });
  socket.emit({ type: 'auth_ok' });
  await waitFor(() => published.at(-1)?.size === 1);

  snapshot = [entity('light.desk'), entity('light.floor')];
  socket.emit({
    type: 'event',
    event: { event_type: 'entity_registry_updated', data: { action: 'create' } },
  });
  await waitFor(() => published.at(-1)?.size === 2);

  // Even if an integration fails to emit a registry event, the periodic
  // authoritative snapshot discovers the new entity shortly afterward.
  snapshot = [entity('light.desk'), entity('light.floor'), entity('light.table')];
  await waitFor(() => published.at(-1)?.size === 3);

  assert.deepEqual([...published.at(-1).keys()], [
    'light.desk',
    'light.floor',
    'light.table',
  ]);
});
