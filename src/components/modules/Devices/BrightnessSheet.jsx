import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  brightnessPct,
  colorTempRange,
  isOn,
  supportsColor,
  supportsColorTemp,
} from '../../../lib/haEntities';

/** Wi-Fi bulbs choke on a command per pointermove; this is plenty responsive. */
const SEND_EVERY_MS = 350;
const PRESETS = [25, 50, 75, 100];

const clamp = (n) => Math.min(100, Math.max(0, n));

/** Whites, warm to cool, with an approximate swatch of each. */
const WHITES = [
  { kelvin: 2700, label: 'Warm', swatch: '#ffb46b' },
  { kelvin: 3000, label: 'Soft', swatch: '#ffc58f' },
  { kelvin: 4000, label: 'Neutral', swatch: '#ffe2c2' },
  { kelvin: 5000, label: 'Cool', swatch: '#fff1e4' },
  { kelvin: 6500, label: 'Daylight', swatch: '#e8efff' },
];

/** Colours as Home Assistant's [hue, saturation]. */
const COLORS = [
  { label: 'Red', hs: [0, 100] },
  { label: 'Orange', hs: [28, 100] },
  { label: 'Yellow', hs: [50, 100] },
  { label: 'Green', hs: [120, 90] },
  { label: 'Teal', hs: [175, 90] },
  { label: 'Blue', hs: [225, 95] },
  { label: 'Purple', hs: [275, 85] },
  { label: 'Pink', hs: [320, 70] },
];

/** The presets this bulb can do, pulled into its range and de-duplicated. */
const whitesFor = (entity) => {
  const { min, max } = colorTempRange(entity);
  const seen = new Set();
  return WHITES.map((w) => ({ ...w, kelvin: Math.min(max, Math.max(min, w.kelvin)) })).filter(
    (w) => !seen.has(w.kelvin) && seen.add(w.kelvin)
  );
};

const hueDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Which preset the light is showing now, if any. */
const activeWhite = (entity, whites) => {
  const a = entity.attributes || {};
  if (!isOn(entity) || a.color_mode !== 'color_temp' || !a.color_temp_kelvin) return null;
  const nearest = whites.reduce((best, w) =>
    Math.abs(w.kelvin - a.color_temp_kelvin) < Math.abs(best.kelvin - a.color_temp_kelvin)
      ? w
      : best
  );
  return Math.abs(nearest.kelvin - a.color_temp_kelvin) <= 250 ? nearest.kelvin : null;
};

const activeColor = (entity) => {
  const a = entity.attributes || {};
  if (!isOn(entity) || a.color_mode === 'color_temp' || !a.hs_color) return null;
  const [h, sat] = a.hs_color;
  if (sat < 40) return null;
  const match = COLORS.find((c) => hueDistance(c.hs[0], h) <= 14);
  return match?.label ?? null;
};

const Swatch = ({ label, color, selected, onClick, showLabel }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    aria-label={label}
    className="flex min-h-[48px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-1.5 transition-colors"
    style={{
      borderColor: selected ? 'var(--fg)' : 'var(--line)',
      backgroundColor: selected ? 'var(--surface-active)' : 'var(--surface-inset)',
      touchAction: 'manipulation',
    }}
  >
    <span
      className="h-8 w-full rounded-xl"
      style={{ backgroundColor: color, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.15)' }}
    />
    {showLabel && <span className="text-xs font-medium text-fg-muted">{label}</span>}
  </button>
);

/**
 * Sends at most once per `ms` while values stream in, and always sends the
 * last one — so a drag ends exactly where the finger lifted.
 */
const createThrottle = (ms) => {
  let lastAt = 0;
  let lastSent = null;
  let pending = null;
  let timer = null;

  const fire = () => {
    clearTimeout(timer);
    timer = null;
    lastAt = performance.now();
    if (pending && pending.value !== lastSent) {
      lastSent = pending.value;
      pending.send(pending.value);
    }
    pending = null;
  };

  return {
    push(value, send, { now = false } = {}) {
      pending = { value, send };
      const wait = ms - (performance.now() - lastAt);
      if (now || wait <= 0) fire();
      else if (!timer) timer = setTimeout(fire, wait);
    },
    flush: () => pending && fire(),
  };
};

/**
 * Controls for one light: a brightness slider big enough to drag with a
 * thumb, presets for the common levels, and warmth and colour swatches when
 * the bulb can do them. Mounted only while open, so the slider initialises
 * from the light each time; while it's open, the finger wins over any
 * brightness updates arriving from Home Assistant.
 *
 * Portalled to <body>: the cards' backdrop-filter and the panel's burn-in
 * transform both trap `position: fixed` inside them, so rendered in place
 * this would be clipped to the devices card.
 */
const BrightnessSheet = ({ entity, name, onBrightness, onColorTemp, onColor, onClose }) => {
  const [value, setValue] = useState(() =>
    isOn(entity) ? (brightnessPct(entity) ?? 100) : 0
  );
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const [throttle] = useState(() => createThrottle(SEND_EVERY_MS));

  // Closing mid-throttle still delivers the last value.
  useEffect(() => () => throttle.flush(), [throttle]);

  const pctAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    return clamp(Math.round(((clientX - r.left) / r.width) * 100));
  };

  const set = (pct, now) => {
    setValue(pct);
    throttle.push(pct, onBrightness, { now });
  };

  // Picking a colour on a light that's off turns it on at full brightness,
  // and the slider follows so it doesn't still say "Off".
  const brightnessForColor = () => {
    if (value > 0) return undefined;
    setValue(100);
    return 100;
  };

  const whites = supportsColorTemp(entity) ? whitesFor(entity) : [];
  const colors = supportsColor(entity) ? COLORS : [];
  const white = activeWhite(entity, whites);
  const color = activeColor(entity);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    set(pctAt(e.clientX), false);
  };

  const onPointerMove = (e) => {
    if (draggingRef.current) set(pctAt(e.clientX), false);
  };

  const onPointerEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    throttle.flush();
  };

  const onKeyDown = (e) => {
    const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
    if (step) {
      e.preventDefault();
      set(clamp(value + step), false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      // On click, not pointerdown: closing on pointerdown lets the rest of the
      // tap land on whatever tile is underneath and toggle it.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} brightness`}
    >
      <div className="card w-full max-w-[680px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-fg">{name}</h3>
            <div className="nums mt-1 text-4xl leading-none font-semibold text-fg">
              {value === 0 ? 'Off' : `${value}%`}
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-primary shrink-0">
            Done
          </button>
        </div>

        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Brightness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={value === 0 ? 'Off' : `${value}%`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
          className="card-inset relative mt-5 h-16 cursor-pointer overflow-hidden outline-none focus-visible:border-accent"
          // The finger drags the slider, never the page behind it.
          style={{ touchAction: 'none' }}
        >
          <div
            className="absolute inset-y-0 left-0 bg-lamp"
            style={{ width: `${value}%`, opacity: 0.35 + (value / 100) * 0.55 }}
          />
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => set(0, true)}
            className="btn"
            aria-pressed={value === 0}
          >
            Off
          </button>
          {PRESETS.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => set(pct, true)}
              className="btn nums"
              aria-pressed={value === pct}
            >
              {pct}%
            </button>
          ))}
        </div>

        {whites.length > 0 && (
          <div className="mt-5">
            <div className="eyebrow mb-2">Warmth</div>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${whites.length}, minmax(0, 1fr))` }}
            >
              {whites.map((w) => (
                <Swatch
                  key={w.kelvin}
                  label={w.label}
                  color={w.swatch}
                  selected={white === w.kelvin}
                  onClick={() => onColorTemp(w.kelvin, brightnessForColor())}
                  showLabel
                />
              ))}
            </div>
          </div>
        )}

        {colors.length > 0 && (
          <div className="mt-4">
            <div className="eyebrow mb-2">Color</div>
            <div className="grid grid-cols-8 gap-2">
              {colors.map((c) => (
                <Swatch
                  key={c.label}
                  label={c.label}
                  color={`hsl(${c.hs[0]} ${c.hs[1]}% 55%)`}
                  selected={color === c.label}
                  onClick={() => onColor(c.hs, brightnessForColor())}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default BrightnessSheet;
