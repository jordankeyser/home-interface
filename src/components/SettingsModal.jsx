import { useEffect, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useDisplay } from '../hooks/useDisplay';
import { themes } from '../config/themes';
import { shutdownHost } from '../lib/displayApi';
import { testHomeAssistant } from '../lib/homeAssistantClient';
import { isSupported } from '../lib/haEntities';
import { connectWifi, getWifiStatus, scanWifiNetworks } from '../lib/wifiClient';
import ConfirmDialog from './ConfirmDialog';
import {
  CloseIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  MoonIcon,
  PowerIcon,
} from './icons';

const SETTINGS_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', detail: 'Weather and transit' },
  { id: 'connections', label: 'Connections', detail: 'Wi-Fi and devices' },
  { id: 'display', label: 'Display', detail: 'Theme and sleep' },
  { id: 'system', label: 'System', detail: 'Power controls' },
];

const SecretField = ({ label, name, value, onChange, placeholder, hint }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={name}
          type={visible ? 'text' : 'password'}
          name={name}
          value={value || ''}
          onChange={onChange}
          className="field"
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="icon-btn shrink-0"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-fg-faint">{hint}</p>}
    </div>
  );
};

const Field = ({ label, name, value, onChange, placeholder, hint, ...rest }) => (
  <div>
    <label className="label" htmlFor={name}>
      {label}
    </label>
    <input
      id={name}
      type="text"
      name={name}
      value={value || ''}
      onChange={onChange}
      className="field"
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      {...rest}
    />
    {hint && <p className="mt-1.5 text-xs text-fg-faint">{hint}</p>}
  </div>
);

const Toggle = ({ label, hint, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="card-inset flex min-h-[56px] w-full items-center justify-between gap-4 px-4 py-3 text-left"
  >
    <span className="min-w-0">
      <span className="block text-sm font-medium text-fg">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-fg-faint">{hint}</span>}
    </span>
    <span
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200"
      style={{ backgroundColor: checked ? 'var(--accent)' : 'var(--line-strong)' }}
    >
      <span
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200"
        style={{ left: checked ? '1.625rem' : '0.25rem' }}
      />
    </span>
  </button>
);

const Section = ({ title, children }) => (
  <section className="card-inset p-4">
    <h3 className="eyebrow mb-3">{title}</h3>
    <div className="space-y-3">{children}</div>
  </section>
);

const NetworkSection = () => {
  const [status, setStatus] = useState({ state: 'loading' });
  const [networks, setNetworks] = useState([]);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    getWifiStatus()
      .then((next) => {
        if (!active) return;
        setStatus({ state: 'ready', ...next });
        if (next.ssid) setSsid(next.ssid);
      })
      .catch((error) => {
        if (active) setStatus({ state: 'error', error: error.message });
      });
    return () => {
      active = false;
    };
  }, []);

  const scan = async () => {
    setBusy('scan');
    setMessage('');
    try {
      const result = await scanWifiNetworks();
      setNetworks(result.networks || []);
      if (!result.networks?.length) setMessage('No nearby networks found');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  const connect = async () => {
    setBusy('connect');
    setMessage('');
    try {
      const next = await connectWifi({ ssid: ssid.trim(), password, hidden });
      setStatus({ state: 'ready', ...next });
      setPassword('');
      setMessage(next.connected ? `Connected to ${next.ssid}` : 'Connection saved');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  const statusText =
    status.state === 'loading'
      ? 'Checking Wi-Fi…'
      : status.connected
        ? `Connected to ${status.ssid}`
        : status.available
          ? 'Wi-Fi is not connected'
          : status.error || 'No Wi-Fi adapter found';

  return (
    <Section title="Network">
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <span
          className={`text-sm font-medium ${status.connected ? 'text-positive' : 'text-fg-muted'}`}
          role="status"
        >
          {statusText}
        </span>
        <button type="button" onClick={scan} disabled={Boolean(busy)} className="btn shrink-0">
          {busy === 'scan' ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {networks.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {networks.slice(0, 6).map((network) => (
            <button
              key={network.ssid}
              type="button"
              onClick={() => {
                setSsid(network.ssid);
                setHidden(false);
                setMessage('');
              }}
              className="card-inset flex min-h-[48px] items-center justify-between gap-3 px-3 py-2 text-left"
              style={
                ssid === network.ssid
                  ? { borderColor: 'var(--accent)', color: 'var(--fg)' }
                  : undefined
              }
            >
              <span className="min-w-0 truncate text-sm font-medium">{network.ssid}</span>
              <span className="shrink-0 text-xs text-fg-faint">
                {network.secure ? 'Secured' : 'Open'} · {network.signal}%
              </span>
            </button>
          ))}
        </div>
      )}

      <Field
        label="Network name"
        name="wifiSsid"
        value={ssid}
        onChange={(event) => {
          setSsid(event.target.value);
          setMessage('');
        }}
        placeholder="Wi-Fi name"
        autoCapitalize="none"
        enterKeyHint="next"
      />
      <SecretField
        label="Wi-Fi password"
        name="wifiPassword"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setMessage('');
        }}
        placeholder="Password"
        hint="Sent only to NetworkManager on this Pi; never saved by the dashboard"
      />
      <Toggle
        label="Hidden network"
        hint="Enable only if the network does not broadcast its name"
        checked={hidden}
        onChange={setHidden}
      />
      <div className="flex min-h-[48px] items-center gap-3">
        <button
          type="button"
          onClick={connect}
          disabled={!ssid.trim() || Boolean(busy)}
          className="btn btn-primary shrink-0 disabled:opacity-40"
        >
          {busy === 'connect' ? 'Connecting…' : 'Connect'}
        </button>
        {message && (
          <span
            className={`min-w-0 text-sm font-medium ${
              status.connected && message.startsWith('Connected') ? 'text-positive' : 'text-fg-muted'
            }`}
            role="status"
          >
            {message}
          </span>
        )}
      </div>
    </Section>
  );
};

/**
 * Checks the address and token as typed — before saving — so a wrong token is
 * caught here rather than as an error on the devices page.
 */
const HomeAssistantSection = ({ url, token, onChange }) => {
  const [test, setTest] = useState({ state: 'idle' });

  const runTest = async () => {
    setTest({ state: 'testing' });
    const result = await testHomeAssistant(url.trim(), token.trim(), { filter: isSupported });
    setTest(
      result.ok
        ? {
            state: 'ok',
            message: `Connected — ${result.count} ${result.count === 1 ? 'device' : 'devices'} found`,
          }
        : { state: 'fail', message: result.reason }
    );
  };

  // Editing either field makes an earlier result meaningless.
  const handleChange = (e) => {
    setTest({ state: 'idle' });
    onChange(e);
  };

  return (
    <Section title="Home Assistant">
      <Field
        label="Address"
        name="haUrl"
        value={url}
        onChange={handleChange}
        placeholder="http://127.0.0.1:8123"
        inputMode="url"
        hint="On the Pi itself this is http://127.0.0.1:8123"
      />
      <SecretField
        label="Access token"
        name="haToken"
        value={token}
        onChange={handleChange}
        placeholder="Long-lived access token"
        hint="Home Assistant → your profile → Security → Long-lived access tokens"
      />
      <div className="flex min-h-[48px] items-center gap-3">
        <button
          type="button"
          onClick={runTest}
          disabled={!url.trim() || !token.trim() || test.state === 'testing'}
          className="btn shrink-0 disabled:opacity-40"
        >
          {test.state === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
        {test.message && (
          <span
            className={`min-w-0 text-sm font-medium ${
              test.state === 'ok' ? 'text-positive' : 'text-danger'
            }`}
            role="status"
          >
            {test.message}
          </span>
        )}
      </div>
    </Section>
  );
};

const SettingsModal = ({ onClose }) => {
  const { settings, updateSettings } = useSettings();
  const { sleep } = useDisplay();

  // Mounted only while open (see Layout), so plain lazy init is enough — no
  // setState-in-effect sync needed.
  const [form, setForm] = useState(settings);
  const [confirm, setConfirm] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const set = (partial) => setForm((prev) => ({ ...prev, ...partial }));

  const handleSave = () => {
    updateSettings(form);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-line px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="icon-btn shrink-0"
            aria-label="Close settings without saving"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 id="settings-title" className="text-xl font-semibold text-fg">
              Settings
            </h2>
            <p className="truncate text-xs text-fg-faint">Changes apply when you save</p>
          </div>
        </div>
        <button type="button" onClick={handleSave} className="btn btn-primary shrink-0">
          <CheckIcon className="h-5 w-5" />
          Save
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[170px_minmax(0,1fr)]">
        <nav
          className="border-r border-line p-2"
          aria-label="Settings sections"
          role="tablist"
          aria-orientation="vertical"
        >
          <div className="space-y-1">
            {SETTINGS_SECTIONS.map((section) => {
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  id={`settings-tab-${section.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`settings-panel-${section.id}`}
                  onClick={() => setActiveSection(section.id)}
                  className="min-h-16 w-full rounded-xl px-3 py-2 text-left"
                  style={
                    active
                      ? { backgroundColor: 'var(--surface)', color: 'var(--fg)' }
                      : { color: 'var(--fg-muted)' }
                  }
                >
                  <span className="block text-sm font-semibold">{section.label}</span>
                  <span className="mt-0.5 block text-xs text-fg-faint">{section.detail}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div
          id={`settings-panel-${activeSection}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${activeSection}`}
          className="scroll-y min-h-0 p-3"
        >
          <div className="mx-auto max-w-[960px]">
            {activeSection === 'dashboard' && (
              <div className="grid grid-cols-[1.1fr_0.9fr] gap-3">
                <Section title="Transit">
                  <SecretField
                    label="CTA API key"
                    name="ctaApiKey"
                    value={form.ctaApiKey}
                    onChange={handleChange}
                    placeholder="Train Tracker API key…"
                    hint="Request one at transitchicago.com/developers"
                  />
                  <Field
                    label="Station ID"
                    name="ctaStationId"
                    value={form.ctaStationId}
                    onChange={handleChange}
                    placeholder="40380"
                    inputMode="numeric"
                    hint="5-digit station MapID"
                  />
                </Section>

                <Section title="Weather">
                  <Field
                    label="Zip code"
                    name="zipCode"
                    value={form.zipCode}
                    onChange={handleChange}
                    placeholder="60601"
                    inputMode="numeric"
                    maxLength={5}
                    hint="No API key needed — powered by Open-Meteo"
                  />
                </Section>
              </div>
            )}

            {activeSection === 'connections' && (
              <div className="space-y-3">
                {import.meta.env.VITE_HOME_INTERFACE_KIOSK === '1' && <NetworkSection />}
                <HomeAssistantSection
                  url={form.haUrl || ''}
                  token={form.haToken || ''}
                  onChange={handleChange}
                />
              </div>
            )}

            {activeSection === 'display' && (
              <div className="grid grid-cols-2 gap-3">
                <Section title="Appearance">
                  <div className="grid grid-cols-2 gap-2">
                    {themes.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => set({ theme: theme.id })}
                        className="btn"
                        style={
                          form.theme === theme.id
                            ? {
                                backgroundColor: 'var(--accent)',
                                color: 'var(--accent-fg)',
                                borderColor: 'transparent',
                              }
                            : undefined
                        }
                      >
                        {theme.name}
                      </button>
                    ))}
                  </div>

                  <Toggle
                    label="Simulate 7-inch panel"
                    hint="Frames the view at 800x480 for desktop testing"
                    checked={Boolean(form.isPiMode)}
                    onChange={(v) => set({ isPiMode: v })}
                  />
                </Section>

                <Section title="Sleep">
                  <div>
                    <span className="label">Sleep after inactivity</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 3, 10, 30].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => set({ idleSleepMinutes: mins })}
                          className="btn"
                          style={
                            Number(form.idleSleepMinutes) === mins
                              ? {
                                  backgroundColor: 'var(--accent)',
                                  color: 'var(--accent-fg)',
                                  borderColor: 'transparent',
                                }
                              : undefined
                          }
                        >
                          {mins === 0 ? 'Never' : `${mins}m`}
                        </button>
                      ))}
                    </div>
                  </div>
                </Section>
              </div>
            )}

            {activeSection === 'system' && (
              <Section title="Power">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      sleep();
                      onClose();
                    }}
                    className="btn min-h-24 flex-col gap-2 py-3"
                  >
                    <MoonIcon className="h-6 w-6" />
                    <span>Sleep display</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setConfirm({
                        title: 'Shut down the Pi?',
                        message:
                          'You will need to physically power-cycle it to turn it back on.',
                        confirmLabel: 'Shut down',
                        destructive: true,
                        action: shutdownHost,
                      })
                    }
                    className="btn min-h-24 flex-col gap-2 py-3"
                    style={{ color: 'var(--danger)' }}
                  >
                    <PowerIcon className="h-6 w-6" />
                    <span>Shut down Pi</span>
                  </button>
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          destructive={confirm.destructive}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            confirm.action?.();
            setConfirm(null);
            onClose();
          }}
        />
      )}
    </div>
  );
};

export default SettingsModal;
