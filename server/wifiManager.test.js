import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeviceStatus, parseNetworkList, parseTerseLine } from './wifiManager.js';

test('parseTerseLine respects escaped colons and backslashes', () => {
  assert.deepEqual(parseTerseLine('wlan0:wifi:connected:Kitchen\\: IoT'), [
    'wlan0',
    'wifi',
    'connected',
    'Kitchen: IoT',
  ]);
  assert.deepEqual(parseTerseLine('one:path\\\\name'), ['one', 'path\\name']);
});

test('parseDeviceStatus finds the Wi-Fi adapter', () => {
  assert.deepEqual(
    parseDeviceStatus('eth0:ethernet:connected:Wired\nwlan0:wifi:connected:4F ORCHARD_ext\n'),
    {
      available: true,
      device: 'wlan0',
      state: 'connected',
      connected: true,
      ssid: '4F ORCHARD_ext',
    }
  );
});

test('parseNetworkList deduplicates SSIDs and keeps the strongest access point', () => {
  assert.deepEqual(
    parseNetworkList(':Guest:30:--\n*:Home:61:WPA2\n:Home:88:WPA2\n:Cafe\\: West:72:WPA2\n'),
    [
      { ssid: 'Home', active: true, signal: 61, secure: true },
      { ssid: 'Cafe: West', active: false, signal: 72, secure: true },
      { ssid: 'Guest', active: false, signal: 30, secure: false },
    ]
  );
});
