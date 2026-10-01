const ROOT = '/api/system/wifi';

const request = async (path, options = {}) => {
  const response = await fetch(`${ROOT}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Wi-Fi operation failed');
  return payload;
};

export const getWifiStatus = () => request('/status');
export const scanWifiNetworks = () => request('/scan', { method: 'POST' });
export const connectWifi = (details) =>
  request('/connect', { method: 'POST', body: JSON.stringify(details) });
