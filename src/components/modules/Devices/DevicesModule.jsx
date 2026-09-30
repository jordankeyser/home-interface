import { useState } from 'react';
import { useHomeAssistant } from '../../../hooks/useHomeAssistant';
import { useDisplay } from '../../../hooks/useDisplay';
import { displayName, isOn } from '../../../lib/haEntities';
import { dragScroll } from '../../../lib/dragScroll';
import { HomeIcon, PowerIcon, WarningIcon } from '../../icons';
import DeviceTile from './DeviceTile';
import BrightnessSheet from './BrightnessSheet';

/** Tiles per row on the 1024px panel. */
const COLUMNS = 4;

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
    turnOff,
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
  const onCount = all.filter(isOn).length;
  const adjusting = adjustingId && all.find((e) => e.entity_id === adjustingId);
  const adjustingGroup = adjusting && groups.find((g) => g.entities.includes(adjusting));

  return (
    <div className="card flex h-full w-full min-w-0 flex-col overflow-hidden p-4">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-xl font-semibold text-fg">
          <HomeIcon className="h-6 w-6 shrink-0 text-accent" />
          <span className="truncate">Home</span>
          {onCount > 0 && (
            <span className="nums ml-1 text-sm font-medium text-fg-muted">{onCount} on</span>
          )}
        </h2>

        <div className="flex shrink-0 items-center gap-2">
          {stale && (
            <span className="text-warning" title="Can’t reach Home Assistant — showing last known state">
              <WarningIcon className="h-5 w-5" />
            </span>
          )}
          <button
            type="button"
            onClick={() => turnOff(all)}
            disabled={stale || onCount === 0}
            className="btn disabled:opacity-40"
          >
            <PowerIcon className="h-5 w-5" />
            All off
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-2 shrink-0 text-sm font-medium text-danger" role="status">
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
        <div ref={dragScroll} className="scroll-y min-h-0 flex-1 pr-1 pb-4">
          {/* Rooms share rows: a one-lamp bedroom sits beside a one-lamp
              kitchen instead of each taking a full row, so a small home fits
              without scrolling. Each room spans as many columns as it has
              devices, up to a full row. */}
          <div
            className="grid gap-x-3 gap-y-4"
            style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
          >
            {groups.map((group) => {
              const span = Math.min(group.entities.length, COLUMNS);
              return (
                <section key={group.id ?? 'other'} style={{ gridColumn: `span ${span}` }}>
                  {group.name && <h3 className="eyebrow mb-2 truncate px-1">{group.name}</h3>}
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

      {adjusting && (
        <BrightnessSheet
          entity={adjusting}
          name={displayName(adjusting, adjustingGroup?.name)}
          onChange={(pct) => setBrightness(adjusting, pct)}
          onClose={() => setAdjustingId(null)}
        />
      )}
    </div>
  );
};

export default DevicesModule;
