import { useState } from 'react';
import { useVacuum } from '../../../hooks/useVacuum';
import { useDisplay } from '../../../hooks/useDisplay';
import {
  isAvailable,
  isBusy,
  modeOptions,
  optionLabel,
  plainOptions,
  statusLabel,
  usesSuction,
  usesWater,
} from '../../../lib/vacuum';
import {
  BatteryIcon,
  CheckIcon,
  DockIcon,
  LocateIcon,
  PauseIcon,
  PlayIcon,
  VacuumIcon,
  WarningIcon,
} from '../../icons';

const Message = ({ icon, title, detail, action }) => (
  <div className="card flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
    {icon}
    <div>
      <div className="text-base font-semibold text-fg">{title}</div>
      {detail && <div className="mt-1 max-w-md text-sm text-fg-muted">{detail}</div>}
    </div>
    {action}
  </div>
);

/** One row of choices, e.g. Quiet | Balanced | Turbo. */
const Choice = ({ label, hint, options, value, onPick, disabled }) => (
  <div className={disabled ? 'opacity-45' : undefined}>
    <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
      <span className="eyebrow">{label}</span>
      {hint && <span className="truncate text-xs text-fg-faint">{hint}</span>}
    </div>
    <div className="control-group flex w-full" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="control-btn min-w-0 flex-1 px-1.5 text-sm font-semibold"
          aria-pressed={option === value}
          disabled={disabled}
          onClick={() => option !== value && onPick(option)}
        >
          <span className="truncate">{optionLabel(option)}</span>
        </button>
      ))}
    </div>
  </div>
);

const roomsLabel = (picked) => {
  if (picked.length === 0) return 'Clean everything';
  if (picked.length <= 2) return `Clean ${picked.map((r) => r.name).join(' + ')}`;
  return `Clean ${picked.length} rooms`;
};

const VacuumModule = ({ onSettingsClick }) => {
  const { url, status, loaded, device, rooms, stale, actionError, sending, actions } =
    useVacuum();
  const { isAsleep } = useDisplay();
  const [picked, setPicked] = useState(() => new Set());

  // Wake to a clean slate: a half-made room selection from yesterday
  // shouldn't be waiting behind the trains page.
  const [wasAsleep, setWasAsleep] = useState(isAsleep);
  if (isAsleep !== wasAsleep) {
    setWasAsleep(isAsleep);
    if (isAsleep && picked.size > 0) setPicked(new Set());
  }

  // The lights page already explains a missing or rejected token; here a
  // short pointer to Settings is enough.
  if (status === 'unconfigured' || status === 'auth_failed' || status === 'invalid_url') {
    return (
      <Message
        icon={<VacuumIcon className="h-10 w-10 text-fg-faint" />}
        title="Connect Home Assistant to control the vacuum"
        action={
          <button type="button" onClick={onSettingsClick} className="btn">
            Open settings
          </button>
        }
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

  if (!device) {
    return (
      <Message
        icon={<VacuumIcon className="h-10 w-10 text-fg-faint" />}
        title="No vacuum in Home Assistant"
        detail="Add the Roborock integration in Home Assistant and the vacuum will show up here."
      />
    );
  }

  const { vacuum, mode, water, passes, battery } = device;
  const online = isAvailable(vacuum) && !stale;
  const busy = isBusy(vacuum);
  const paused = vacuum.state === 'paused';
  const docked = vacuum.state === 'docked';
  const batteryLevel = isAvailable(battery)
    ? Math.round(Number(battery.state))
    : (vacuum.attributes?.battery_level ?? null);

  const currentMode = isAvailable(mode) ? mode.state : null;
  const fanSpeeds = plainOptions(vacuum.attributes?.fan_speed_list);
  const waterLevels = plainOptions(water?.attributes?.options);
  const passOptions = plainOptions(passes?.attributes?.options);

  const roomList = rooms || [];
  const pickedRooms = roomList.filter((r) => picked.has(r.id));
  const togglePick = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const start = () => {
    if (pickedRooms.length > 0) actions.cleanRooms(pickedRooms.map((r) => r.id));
    else actions.cleanAll();
    setPicked(new Set());
  };

  const summary = [
    currentMode && optionLabel(currentMode),
    usesSuction(currentMode) && vacuum.attributes?.fan_speed && `${optionLabel(vacuum.attributes.fan_speed)} suction`,
    usesWater(currentMode) && isAvailable(water) && `${optionLabel(water.state)} water`,
    passes?.state === 'two' && 'two passes',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="card flex h-full w-full min-w-0 flex-col overflow-hidden p-4">
      <div className="mb-3 flex min-h-12 shrink-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-xl font-semibold text-fg">
          <VacuumIcon className="h-6 w-6 shrink-0 text-accent" />
          <span className="truncate">Vacuum</span>
        </h2>

        {stale ? (
          <span
            className="flex shrink-0 items-center gap-2 text-sm font-medium text-warning"
            title="Can’t reach Home Assistant — showing last known state"
          >
            <WarningIcon className="h-5 w-5" />
            Offline
          </span>
        ) : (
          actionError && (
            <span
              className="min-w-0 truncate text-sm font-medium text-danger"
              role="status"
              aria-live="polite"
              title={actionError}
            >
              {actionError}
            </span>
          )
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-3">
        {/* Left: what it's doing, and how it should clean */}
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="card-inset shrink-0 p-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: busy
                    ? 'color-mix(in srgb, var(--accent) 28%, var(--surface))'
                    : 'var(--surface)',
                  color: busy ? 'var(--fg)' : 'var(--fg-muted)',
                }}
              >
                <VacuumIcon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-fg">
                  {statusLabel(vacuum, device.status)}
                </div>
                <div className="truncate text-sm text-fg-muted">
                  {vacuum.attributes?.friendly_name || 'Vacuum'}
                </div>
              </div>
              {batteryLevel !== null && Number.isFinite(batteryLevel) && (
                <span
                  className={`nums flex shrink-0 items-center gap-1.5 text-sm font-semibold ${batteryLevel <= 20 ? 'text-warning' : 'text-fg-muted'}`}
                >
                  <BatteryIcon level={batteryLevel} className="h-6 w-6" />
                  {batteryLevel}%
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {busy && vacuum.state === 'cleaning' ? (
                <button
                  type="button"
                  className="btn px-2"
                  onClick={actions.pause}
                  disabled={!online || sending === 'pause'}
                >
                  <PauseIcon className="h-5 w-5" /> Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="btn px-2"
                  onClick={actions.resume}
                  disabled={!online || !paused || sending === 'pause'}
                >
                  <PlayIcon className="h-5 w-5" /> Resume
                </button>
              )}
              <button
                type="button"
                className="btn px-2"
                onClick={actions.dock}
                disabled={!online || docked || vacuum.state === 'returning' || sending === 'dock'}
              >
                <DockIcon className="h-5 w-5" /> Dock
              </button>
              <button
                type="button"
                className="btn px-2"
                onClick={actions.locate}
                disabled={!online || sending === 'locate'}
              >
                <LocateIcon className="h-5 w-5" /> Find
              </button>
            </div>
          </div>

          <div className="card-inset scroll-y min-h-0 flex-1 px-3 py-2.5">
            <div className="flex flex-col gap-2.5">
              {currentMode && (
                <Choice
                  label="Clean with"
                  options={modeOptions(mode)}
                  value={currentMode}
                  onPick={(option) => actions.select(mode, option)}
                  disabled={!online || busy}
                />
              )}
              {fanSpeeds.length > 0 && (
                <Choice
                  label="Suction"
                  hint={usesSuction(currentMode) ? null : 'Not used when mopping only'}
                  options={fanSpeeds}
                  value={vacuum.attributes?.fan_speed}
                  onPick={actions.setFanSpeed}
                  disabled={!online || !usesSuction(currentMode)}
                />
              )}
              {waterLevels.length > 0 && isAvailable(water) && (
                <Choice
                  label="Water"
                  hint={usesWater(currentMode) ? null : 'Not used when vacuuming only'}
                  options={waterLevels}
                  value={water.state}
                  onPick={(option) => actions.select(water, option)}
                  disabled={!online || !usesWater(currentMode)}
                />
              )}
              {passOptions.length > 0 && isAvailable(passes) && (
                <Choice
                  label="Passes"
                  options={passOptions}
                  value={passes.state}
                  onPick={(option) => actions.select(passes, option)}
                  disabled={!online || busy}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right: where to clean, and go */}
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="card-inset flex min-h-0 flex-1 flex-col p-3">
            <div className="mb-2 flex min-h-12 shrink-0 items-center justify-between gap-2 px-1">
              <span className="eyebrow">Rooms</span>
              {picked.size > 0 && (
                <button
                  type="button"
                  className="btn min-h-12 px-3"
                  onClick={() => setPicked(new Set())}
                >
                  Clear
                </button>
              )}
            </div>

            {rooms === undefined ? (
              <div className="flex flex-1 items-center justify-center text-sm text-fg-muted">
                Loading rooms…
              </div>
            ) : roomList.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 px-3 text-center">
                <div className="text-base font-semibold text-fg">Rooms aren’t set up yet</div>
                <div className="text-sm text-fg-muted">
                  In Home Assistant, open the vacuum, tap the gear, choose “Configure areas”
                  and match each Roborock room to a Home Assistant area. Until then, it cleans
                  everything.
                </div>
              </div>
            ) : (
              <div className="scroll-y min-h-0 flex-1 pr-1">
                <div className="grid grid-cols-2 gap-2">
                  {roomList.map((room) => {
                    const on = picked.has(room.id);
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => togglePick(room.id)}
                        aria-pressed={on}
                        disabled={!online || busy}
                        className="card-inset card-inset-hover flex min-h-14 items-center gap-2 px-3 text-left disabled:opacity-45"
                        style={
                          on
                            ? {
                                background:
                                  'color-mix(in srgb, var(--accent) 22%, var(--surface-inset))',
                                borderColor: 'color-mix(in srgb, var(--accent) 55%, transparent)',
                              }
                            : undefined
                        }
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                          style={{
                            borderColor: on ? 'var(--accent)' : 'var(--line-strong)',
                            background: on ? 'var(--accent)' : 'transparent',
                            color: 'var(--accent-fg)',
                          }}
                        >
                          {on && <CheckIcon className="h-4 w-4" />}
                        </span>
                        <span className="truncate text-sm font-semibold text-fg">{room.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={start}
            disabled={!online || busy || sending === 'clean'}
            className="btn btn-primary min-h-[88px] shrink-0 flex-col gap-0.5 rounded-[1.25rem] disabled:opacity-50"
          >
            <span className="text-xl font-semibold">
              {sending === 'clean'
                ? 'Starting…'
                : busy
                  ? 'Cleaning…'
                  : roomsLabel(pickedRooms)}
            </span>
            {summary && <span className="text-sm font-medium opacity-80">{summary}</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VacuumModule;
