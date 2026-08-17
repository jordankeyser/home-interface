import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useDisplay } from '../hooks/useDisplay';
import { themes } from '../config/themes';
import { PROVIDERS } from '../lib/stockProviders';
import { shutdownHost, rebootHost } from '../lib/displayApi';
import ConfirmDialog from './ConfirmDialog';
import {
  CloseIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  MoonIcon,
  PowerIcon,
  RefreshIcon,
} from './icons';

const SecretField =({ label, name, value, onChange, placeholder, hint }) => {
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
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
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

const SettingsModal = ({ onClose }) => {
  const { settings, updateSettings } = useSettings();
  const { sleep } = useDisplay();

  // Mounted only while open (see Layout), so plain lazy init is enough — no
  // setState-in-effect sync needed.
  const [form, setForm] = useState(settings);
  const [confirm, setConfirm] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const set = (partial) => setForm((prev) => ({ ...prev, ...partial }));

  const handleSave = () => {
    updateSettings(form);
    onClose();
  };

  const provider = PROVIDERS[form.stockProvider] || PROVIDERS.finnhub;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-3">
        <h2 className="text-xl font-semibold text-fg">Settings</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="btn">
            <CloseIcon className="h-5 w-5" />
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn btn-primary">
            <CheckIcon className="h-5 w-5" />
            Save
          </button>
        </div>
      </header>

      <div className="scroll-y min-h-0 flex-1 p-4">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Section title="Transit">
              <SecretField
                label="CTA API key"
                name="ctaApiKey"
                value={form.ctaApiKey}
                onChange={handleChange}
                placeholder="Train Tracker API key"
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

            <Section title="Markets">
              <div>
                <span className="label">Quote provider</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(PROVIDERS).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => set({ stockProvider: p.id })}
                      className="btn"
                      style={
                        form.stockProvider === p.id
                          ? {
                              backgroundColor: 'var(--accent)',
                              color: 'var(--accent-fg)',
                              borderColor: 'transparent',
                            }
                          : undefined
                      }
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-fg-faint">{provider.hint}</p>
              </div>

              <SecretField
                label={`${provider.name} API key`}
                name="stockApiKey"
                value={form.stockApiKey}
                onChange={handleChange}
                placeholder="Required to load quotes"
                hint={`Get a free key at ${provider.keyUrl}`}
              />

              <Field
                label="Symbols"
                name="stockSymbols"
                value={form.stockSymbols}
                onChange={handleChange}
                placeholder="AAPL, MSFT, TSLA"
                hint="Comma-separated, up to 12 tickers"
              />
            </Section>
          </div>

          <div className="space-y-4">
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
                hint="Frames the view at 1024x600 for desktop testing"
                checked={Boolean(form.isPiMode)}
                onChange={(v) => set({ isPiMode: v })}
              />
            </Section>

            <Section title="Display">
              <Toggle
                label="Ambient dimming"
                hint="Lowers the backlight in the evening and overnight"
                checked={form.ambientDimming !== false}
                onChange={(v) => set({ ambientDimming: v })}
              />

              <div>
                <span className="label">Sleep after inactivity</span>
                <div className="grid grid-cols-4 gap-2">
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

            <Section title="Power">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sleep();
                    onClose();
                  }}
                  className="btn flex-col gap-1 py-3"
                >
                  <MoonIcon className="h-5 w-5" />
                  <span className="text-xs">Sleep</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setConfirm({
                      title: 'Restart the Pi?',
                      message: 'The panel will be dark for about a minute.',
                      confirmLabel: 'Restart',
                      action: rebootHost,
                    })
                  }
                  className="btn flex-col gap-1 py-3"
                >
                  <RefreshIcon className="h-5 w-5" />
                  <span className="text-xs">Restart</span>
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
                  className="btn flex-col gap-1 py-3"
                  style={{ color: 'var(--danger)' }}
                >
                  <PowerIcon className="h-5 w-5" />
                  <span className="text-xs">Shut down</span>
                </button>
              </div>
            </Section>
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
