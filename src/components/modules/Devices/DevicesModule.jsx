import { useCallback, useState } from 'react';
import { useHomeAssistant } from '../../../hooks/useHomeAssistant';
import { useDisplay } from '../../../hooks/useDisplay';
import { displayName, isOn } from '../../../lib/haEntities';
import { BulbIcon, HomeIcon, PowerIcon, WarningIcon } from '../../icons';
import DeviceTile from './DeviceTile';
import BrightnessSheet from './BrightnessSheet';

/** Tiles per row in the device half of the 800px panel. */
const COLUMNS = 2;

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
    turnOn,
    turnOff,
  } = useHomeAssistant();
  const { isAsleep } = useDisplay();
  const [adjustingId, setAdjustingId] = useState(null);
  const closeBrightness = useCallback(() => setAdjustingId(null), []);

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
  const onCount = all.filter(isOn).length;
  const offCount = all.filter((entity) => entity.state === 'off').length;
  const adjusting = adjustingId && all.find((e) => e.entity_id === adjustingId);
  const adjustingGroup = adjusting && groups.find((g) => g.entities.includes(adjusting));

  return (
    <div className="card flex h-full w-full min-w-0 flex-col overflow-hidden p-4">
      <div className="mb-3 flex min-h-12 shrink-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-xl font-semibold text-fg">
          <HomeIcon className="h-6 w-6 shrink-0 text-accent" />
          <span className="truncate">Home</span>
          {onCount > 0 && (
            <span className="nums ml-1 text-sm font-medium text-fg-muted">{onCount} on</span>
          )}
        </h2>

        {stale && (
          <span
            className="flex shrink-0 items-center gap-2 text-sm font-medium text-warning"
            title="Can’t reach Home Assistant — showing last known state"
          >
            <WarningIcon className="h-5 w-5" />
            Offline
          </span>
        )}
      </div>

      {actionError && (
        <div className="mb-2 shrink-0 text-sm font-medium text-danger" role="status" aria-live="polite">
          {actionError}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div className="card-inset min-h-0 overflow-hidden p-3">
          {all.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <div className="text-base font-semibold text-fg">No devices yet</div>
              <div className="text-sm text-fg-muted">
                Lights, switches and fans will appear here.
              </div>
            </div>
          ) : (
            <div className="scroll-y h-full pr-1 pb-3">
              <div
                className="grid gap-x-3 gap-y-4"
                style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
              >
                {groups.map((group) => {
                  const span = Math.min(group.entities.length, COLUMNS);
                  return (
                    <section key={group.id ?? 'other'} style={{ gridColumn: `span ${span}` }}>
                      {group.name && (
                        <h3 className="eyebrow mb-2 truncate px-1">{group.name}</h3>
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

        <div className="grid min-h-0 grid-rows-2 gap-3">
          <button
            type="button"
            onClick={() => turnOn(all)}
            disabled={stale || offCount === 0}
            className="flex min-h-0 flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-line bg-surface-inset p-5 text-center active:bg-surface-hover disabled:opacity-40"
            style={{
              backgroundColor:
                offCount > 0 && !stale
                  ? 'color-mix(in srgb, var(--lamp) 11%, var(--surface-inset))'
                  : undefined,
            }}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lamp text-[#211700]">
              <BulbIcon className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-xl font-semibold text-fg">All on</span>
              <span className="mt-1 block text-sm text-fg-muted">Turn every device on</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => turnOff(all)}
            disabled={stale || onCount === 0}
            className="flex min-h-0 flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-line bg-surface-inset p-5 text-center active:bg-surface-hover disabled:opacity-40"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-fg-muted">
              <PowerIcon className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-xl font-semibold text-fg">All off</span>
              <span className="mt-1 block text-sm text-fg-muted">Turn every device off</span>
            </span>
          </button>
        </div>
      </div>

      {adjusting && (
        <BrightnessSheet
          entity={adjusting}
          name={displayName(adjusting, adjustingGroup?.name)}
          onChange={(pct) => setBrightness(adjusting, pct)}
          onClose={closeBrightness}
        />
      )}
    </div>
  );
};

export default DevicesModule;
