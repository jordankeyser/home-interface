import {
  brightnessPct,
  domainOf,
  isOn,
  isUnavailable,
  statusText,
  supportsBrightness,
} from '../../../lib/haEntities';
import { BulbIcon, FanIcon, SlidersIcon, SwitchIcon } from '../../icons';

/** One icon per supported domain (see DOMAINS in lib/haEntities). */
const ICONS = {
  light: BulbIcon,
  switch: SwitchIcon,
  fan: FanIcon,
};

const LIT_TILE = {
  backgroundColor: 'color-mix(in srgb, var(--lamp) 14%, var(--surface-inset))',
  borderColor: 'color-mix(in srgb, var(--lamp) 40%, transparent)',
};

/**
 * Tap anywhere to toggle. Dimmable lights get a separate brightness button
 * rather than a long-press, which nobody would discover on a wall panel.
 */
const DeviceTile = ({ entity, name, disabled, onToggle, onAdjust }) => {
  const on = isOn(entity);
  const unavailable = isUnavailable(entity);
  const Icon = ICONS[domainOf(entity.entity_id)] || SwitchIcon;
  const dimmable = supportsBrightness(entity) && !unavailable;
  const pct = on && dimmable ? brightnessPct(entity) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onToggle(entity)}
        disabled={disabled || unavailable}
        aria-pressed={on}
        className="card-inset card-inset-hover flex min-h-[112px] w-full flex-col items-start justify-between gap-3 p-3.5 text-left transition-transform duration-150 active:scale-[0.98] disabled:opacity-45"
        style={on ? LIT_TILE : undefined}
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200"
          style={
            on
              ? { backgroundColor: 'var(--lamp)', color: '#1f1500' }
              : { backgroundColor: 'var(--surface)', color: 'var(--fg-muted)' }
          }
        >
          <Icon className="h-6 w-6" />
        </span>

        <span className={`w-full min-w-0 ${dimmable ? 'pr-1' : ''}`}>
          <span className="block truncate text-base font-semibold text-fg">{name}</span>
          <span className="nums block text-sm text-fg-muted">{statusText(entity)}</span>
        </span>
      </button>

      {dimmable && (
        <button
          type="button"
          onClick={() => onAdjust(entity)}
          disabled={disabled}
          className="icon-btn absolute top-2 right-2"
          aria-label={`Adjust ${name} brightness`}
        >
          <SlidersIcon className="h-5 w-5" />
        </button>
      )}

      {pct !== null && (
        <span className="pointer-events-none absolute inset-x-3.5 bottom-1.5 h-1 overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-lamp" style={{ width: `${pct}%` }} />
        </span>
      )}
    </div>
  );
};

export default DeviceTile;
