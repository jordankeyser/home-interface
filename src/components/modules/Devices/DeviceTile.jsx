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
    <div
      className="card-inset overflow-hidden"
      style={on ? LIT_TILE : undefined}
    >
      <button
        type="button"
        onClick={() => onToggle(entity)}
        disabled={disabled || unavailable}
        aria-pressed={on}
        className="card-inset-hover flex min-h-[92px] w-full items-center gap-2.5 p-2.5 text-left disabled:opacity-45"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200"
          style={
            on
              ? { backgroundColor: 'var(--lamp)', color: '#1f1500' }
              : { backgroundColor: 'var(--surface)', color: 'var(--fg-muted)' }
          }
        >
          <Icon className="h-5 w-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">{name}</span>
          <span className="nums block text-sm text-fg-muted">{statusText(entity)}</span>
        </span>
      </button>

      {dimmable && (
        <button
          type="button"
          onClick={() => onAdjust(entity)}
          disabled={disabled}
          className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-line px-3 text-sm font-semibold text-fg-muted active:bg-surface-hover disabled:opacity-45"
          aria-label={`Adjust ${name} brightness`}
        >
          <SlidersIcon className="h-5 w-5" />
          <span>{pct === null ? 'Brightness' : `${pct}% brightness`}</span>
        </button>
      )}
    </div>
  );
};

export default DeviceTile;
