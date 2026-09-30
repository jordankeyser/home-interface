import { useState } from 'react';
import { useHomeAssistant } from '../../../hooks/useHomeAssistant';
import { useDisplay } from '../../../hooks/useDisplay';
import { displayName, isLight, isOn, isUnavailable } from '../../../lib/haEntities';
import { BulbIcon, HomeIcon, PowerIcon, WarningIcon } from '../../icons';
import DeviceTile from './DeviceTile';
import BrightnessSheet from './BrightnessSheet';

/** Tiles per row in the device list (the left 60% of the panel). */
const COLUMNS = 3;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const Message = ({ icon, title, detail, action }) => (
  <div className="card flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
    {icon}
    <div>
      <div className="text-base font-semibold text-fg">{title}</div>
      {detail && <div className="mt-1 text-sm text-fg-muted">{detail}</div>}
    </div>
    {action}
  </div>
);

const MASTER_STYLES = {
  on: {
    button: {
      backgroundColor: 'color-mix(in srgb, var(--lamp) 16%, var(--surface-inset))',
      borderColor: 'color-mix(in srgb, var(--lamp) 45%, transparent)',
    },
    badge: { backgroundColor: 'var(--lamp)', color: '#1f1500' },
  },
  off: {
    button: undefined,
    badge: { backgroundColor: 'var(--surface-active)', color: 'var(--fg)' },
  },
};

/**
 * The two big targets you can hit without looking. Solid fills rather than
 * the cards' frosted glass: a backdrop blur this large is expensive on the
 * Pi's GPU, and these don't need it.
 */
const MasterButton = ({ kind, title, detail, disabled, onClick }) => {
  const styles = MASTER_STYLES[kind];
  const Icon = kind === 'on' ? BulbIcon : PowerIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="master-btn flex min-h-0 flex-1 flex-col items-start justify-between p-6 text-left"
      style={styles.button}
    >
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={styles.badge}
      >
        <Icon className="h-8 w-8" />
      </span>
      <span>
        <span className="block text-4xl leading-tight font-semibold text-fg">{title}</span>
        <span className="nums mt-1 block text-base text-fg-muted">{detail}</span>
      </span>
    </button>
  );
};

const DevicesModule = ({ onSettingsClick }) => {
  const {
    url,
    status,
    loaded,
    groups,
    stale,
    actionError,
    toggle,
    setBrightness,
    setColorTemp,
    setColor,
    setPower,
  } = useHomeAssistant();
  const { isAsleep } = useDisplay();
  const [adjustingId, setAdjustingId] = useState(null);

  // The panel wakes to the first page, so a brightness sheet left open when
  // it slept shouldn't be sitting over the trains. Adjusting state during
  // render is React's pattern for resetting on a prop change.
  const [wasAsleep, setWasAsleep] = useState(isAsleep);
  if (isAsleep !== wasAsleep) {
    setWasAsleep(isAsleep);
    if (isAsleep) setAdjustingId(null);
  }

  const settingsButton = (
    <button type="button" onClick={onSettingsClick} className="btn">
      Open settings
    </button>
  );

  if (status === 'unconfigured') {
    return (
      <Message
        icon={<HomeIcon className="h-10 w-10 text-fg-faint" />}
        title="Connect Home Assistant"
        detail="Add your Home Assistant address and an access token in Settings."
        action={settingsButton}
      />
    );
  }

  if (status === 'auth_failed') {
    return (
      <Message
        icon={<WarningIcon className="h-9 w-9 text-danger" />}
        title="Home Assistant rejected the access token"
        detail="Create a new long-lived token under your Home Assistant profile → Security."
        action={settingsButton}
      />
    );
  }

  if (status === 'invalid_url') {
    return (
      <Message
        icon={<WarningIcon className="h-9 w-9 text-danger" />}
        title="That Home Assistant address isn’t valid"
        detail="It should look like http://127.0.0.1:8123"
        action={settingsButton}
      />
    );
  }

  if (!loaded) {
    return status === 'closed' ? (
      <Message
        icon={<WarningIcon className="h-9 w-9 text-warning" />}
        title="Can’t reach Home Assistant"
        detail={`Retrying ${url} automatically`}
      />
    ) : (
      <Message title="Connecting to Home Assistant…" />
    );
  }

  const all = groups.flatMap((g) => g.entities);
  // "All on" means lights. Switching every plug on at once could start a
  // heater or anything else plugged into one.
  const lights = all.filter((e) => isLight(e) && !isUnavailable(e));
  const lightsOn = lights.filter(isOn).length;
  const lightsOff = lights.length - lightsOn;
  const adjusting = adjustingId && all.find((e) => e.entity_id === adjustingId);
  const adjustingGroup = adjusting && groups.find((g) => g.entities.includes(adjusting));

  return (
    <div className="grid h-full w-full min-w-0 grid-cols-[3fr_2fr] gap-4">
      <div className="card flex min-h-0 min-w-0 flex-col overflow-hidden p-4">
        <div className="mb-1 flex shrink-0 items-center justify-between gap-3 pl-1">
          <h2 className="flex min-w-0 items-center gap-2.5 text-xl font-semibold text-fg">
            <HomeIcon className="h-6 w-6 shrink-0 text-accent" />
            <span className="truncate">Home</span>
          </h2>
          <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
            {stale && (
              <span className="flex items-center gap-1.5 text-warning">
                <WarningIcon className="h-4 w-4" />
                Offline
              </span>
            )}
            {lights.length > 0 && (
              <span className="nums text-fg-muted">
                {lightsOn} of {plural(lights.length, 'light')} on
              </span>
            )}
          </div>
        </div>

        {actionError && (
          <div className="mb-1 shrink-0 px-1 text-sm font-medium text-danger" role="status">
            {actionError}
          </div>
        )}

        {all.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <div className="text-base font-semibold text-fg">No devices yet</div>
            <div className="text-sm text-fg-muted">
              Lights, switches and fans you add in Home Assistant will appear here.
            </div>
          </div>
        ) : (
          <div className="scroll-y min-h-0 flex-1 pr-1 pb-4">
            {/* Rooms share rows: a one-lamp bedroom sits beside a one-lamp
                kitchen instead of each taking a full row. Each room spans as
                many columns as it has devices, up to a full row. */}
            <div
              className="grid gap-x-3"
              style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
            >
              {groups.map((group) => {
                const span = Math.min(group.entities.length, COLUMNS);
                const roomLights = group.entities.filter(
                  (e) => isLight(e) && !isUnavailable(e)
                );
                const anyOn = roomLights.some(isOn);
                // A room with one light already has its switch: the tile.
                const roomToggle = roomLights.length > 1;
                return (
                  <section key={group.id ?? 'other'} style={{ gridColumn: `span ${span}` }}>
                    {(group.name || roomToggle) && (
                    <div className="flex h-12 items-center justify-between gap-2 px-1">
                      <h3 className="eyebrow truncate">{group.name}</h3>
                      {roomToggle && (
                        <button
                          type="button"
                          onClick={() => setPower(roomLights, !anyOn)}
                          disabled={stale}
                          className="btn -mr-1 shrink-0 px-4 disabled:opacity-40"
                          aria-label={`Turn ${group.name ?? 'all'} lights ${anyOn ? 'off' : 'on'}`}
                        >
                          {anyOn ? 'Turn off' : 'Turn on'}
                        </button>
                      )}
                    </div>
                    )}
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}
                    >
                      {group.entities.map((entity) => (
                        <DeviceTile
                          key={entity.entity_id}
                          entity={entity}
                          name={displayName(entity, group.name)}
                          disabled={stale}
                          onToggle={toggle}
                          onAdjust={(e) => setAdjustingId(e.entity_id)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <MasterButton
          kind="on"
          title="All on"
          detail={
            lights.length === 0
              ? 'No lights yet'
              : lightsOff === 0
                ? 'Every light is on'
                : `Turn on ${plural(lightsOff, 'light')}`
          }
          disabled={stale || lightsOff === 0}
          onClick={() => setPower(lights, true)}
        />
        <MasterButton
          kind="off"
          title="All off"
          detail={
            lights.length === 0
              ? 'No lights yet'
              : lightsOn === 0
                ? 'Every light is off'
                : `Turn off ${plural(lightsOn, 'light')}`
          }
          disabled={stale || lightsOn === 0}
          onClick={() => setPower(lights, false)}
        />
      </div>

      {adjusting && (
        <BrightnessSheet
          entity={adjusting}
          name={displayName(adjusting, adjustingGroup?.name)}
          onBrightness={(pct) => setBrightness(adjusting, pct)}
          onColorTemp={(kelvin) => setColorTemp(adjusting, kelvin)}
          onColor={(hs) => setColor(adjusting, hs)}
          onClose={() => setAdjustingId(null)}
        />
      )}
    </div>
  );
};

export default DevicesModule;
