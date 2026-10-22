import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  brightnessPct,
  hsToRgb,
  isOn,
  kelvinRange,
  kelvinToRgb,
  supportsColor,
  supportsColorTemp,
} from '../../../lib/haEntities';

/** Wi-Fi bulbs choke on a command per pointermove; this is plenty responsive. */
const SEND_EVERY_MS = 350;
const PRESETS = [25, 50, 75, 100];

const COLORS = [
  { name: 'Red', hs: [0, 100] },
  { name: 'Orange', hs: [30, 100] },
  { name: 'Yellow', hs: [52, 100] },
  { name: 'Green', hs: [120, 100] },
  { name: 'Cyan', hs: [180, 100] },
  { name: 'Blue', hs: [230, 100] },
  { name: 'Purple', hs: [275, 100] },
  { name: 'Pink', hs: [320, 70] },
].map((c) => ({ ...c, rgb: hsToRgb(c.hs) }));

const WHITES = [
  { name: 'Candle', kelvin: 2200 },
  { name: 'Warm', kelvin: 2700 },
  { name: 'Neutral', kelvin: 4000 },
  { name: 'Daylight', kelvin: 6500 },
];

const clamp = (n) => Math.min(100, Math.max(0, n));

/**
 * The whites this bulb can make, clamped to its range. When two clamp to the
 * same value, the one that needed the smaller nudge keeps its name.
 */
const whitesFor = (entity) => {
  const [min, max] = kelvinRange(entity);
  const byKelvin = new Map();
  WHITES.forEach((w) => {
    const kelvin = Math.min(max, Math.max(min, w.kelvin));
    const prev = byKelvin.get(kelvin);
    if (!prev || Math.abs(w.kelvin - kelvin) < Math.abs(prev.wanted - kelvin)) {
      byKelvin.set(kelvin, { name: w.name, wanted: w.kelvin, kelvin, rgb: kelvinToRgb(kelvin) });
    }
  });
  return [...byKelvin.values()];
};

const nearest = (items, distance) =>
  items.reduce((best, item) => (distance(item) < distance(best) ? item : best), items[0]);

const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Which swatch matches what the bulb is showing now, if any. */
const activeSwatch = (entity, whites) => {
  if (!isOn(entity)) return null;
  const a = entity.attributes || {};
  if (a.color_mode === 'color_temp' && typeof a.color_temp_kelvin === 'number') {
    return whites.length ? nearest(whites, (w) => Math.abs(w.kelvin - a.color_temp_kelvin)) : null;
  }
  // Pale tints read as white, not as the nearest colour.
  if (Array.isArray(a.hs_color) && a.hs_color[1] >= 25) {
    const [h, s] = a.hs_color;
    return nearest(COLORS, (c) => hueGap(c.hs[0], h) + Math.abs(c.hs[1] - s) / 2);
  }
  return null;
};

const rgbCss = (rgb) => `rgb(${rgb.join(' ')})`;

const SwatchRow = ({ label, className = 'gap-2', children }) => (
  <div className="mt-4 flex items-center gap-3">
    <span className="w-16 shrink-0 text-sm font-semibold text-fg-muted">{label}</span>
    <div className={`flex min-w-0 flex-1 ${className}`}>{children}</div>
  </div>
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
 * Brightness for one light. A slider big enough to drag with a thumb, plus
 * presets for the common levels. Mounted only while open, so its value
 * initialises from the light each time; while it's open, the finger wins over
 * any state updates arriving from Home Assistant.
 *
 * Bulbs that report colour or colour-temperature modes also get a row of
 * colour swatches and a row of whites. Those send at once, unthrottled — one
 * tap is one command.
 *
 * Portalled to <body>: the panel's burn-in transform traps `position: fixed`
 * inside it, so rendered in place this would be clipped to the devices card.
 */
const BrightnessSheet = ({ entity, name, onChange, onColor, onClose }) => {
  const [value, setValue] = useState(() =>
    isOn(entity) ? (brightnessPct(entity) ?? 100) : 0
  );
  const trackRef = useRef(null);
  const doneRef = useRef(null);
  const draggingRef = useRef(false);
  const [throttle] = useState(() => createThrottle(SEND_EVERY_MS));

  // Closing mid-throttle still delivers the last value.
  useEffect(() => () => throttle.flush(), [throttle]);

  useEffect(() => {
    const onWindowKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onWindowKeyDown);
    doneRef.current?.focus();
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [onClose]);

  const pctAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    return clamp(Math.round(((clientX - r.left) / r.width) * 100));
  };

  const set = (pct, now) => {
    setValue(pct);
    throttle.push(pct, onChange, { now });
  };

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

  const showColors = supportsColor(entity);
  const whites = supportsColorTemp(entity) ? whitesFor(entity) : [];
  const active = activeSwatch(entity, whites);

  /** turn_on lights the bulb, so an "Off" slider comes back up with it. */
  const pickColor = (color) => {
    // A brightness change still waiting in the throttle mustn't land after
    // this and switch the bulb back off.
    throttle.flush();
    const relight = value === 0 ? 100 : undefined;
    if (relight) setValue(relight);
    onColor({ ...color, brightnessPct: relight });
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
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-3 sm:items-center"
      // On click, not pointerdown: closing on pointerdown lets the rest of the
      // tap land on whatever tile is underneath and toggle it.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} light settings`}
    >
      <div className="card w-full max-w-[620px] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-fg">{name}</h3>
            <div className="nums mt-1 text-4xl leading-none font-semibold text-fg">
              {value === 0 ? 'Off' : `${value}%`}
            </div>
          </div>
          <button
            ref={doneRef}
            type="button"
            onClick={onClose}
            className="btn btn-primary shrink-0"
          >
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
          className="brightness-slider card-inset relative mt-5 flex h-20 cursor-pointer items-center px-4"
          // The finger drags the slider, never the page behind it.
          style={{ touchAction: 'none' }}
        >
          <div className="relative h-3 w-full rounded-full bg-line-strong">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-lamp"
              style={{ width: `${value}%` }}
            />
            <span
              className="absolute top-1/2 h-7 w-7 rounded-full border-2 border-white bg-lamp shadow-md"
              style={{
                left: `${value}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2">
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
              style={value === pct ? { borderColor: 'var(--accent)' } : undefined}
            >
              {pct}%
            </button>
          ))}
        </div>

        {showColors && (
          <SwatchRow label="Colour" className="justify-between gap-1">
            {COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => pickColor({ hs: c.hs, rgb: c.rgb })}
                className="h-12 w-12 shrink-0 cursor-pointer rounded-full border-2 border-line"
                aria-label={c.name}
                aria-pressed={active === c}
                style={{
                  background: rgbCss(c.rgb),
                  ...(active === c && {
                    borderColor: 'var(--fg)',
                    boxShadow: '0 0 0 3px var(--accent)',
                  }),
                }}
              />
            ))}
          </SwatchRow>
        )}

        {whites.length > 0 && (
          <SwatchRow label="White">
            {whites.map((w) => (
              <button
                key={w.kelvin}
                type="button"
                onClick={() => pickColor({ kelvin: w.kelvin, rgb: w.rgb })}
                className="btn flex-1 px-2"
                aria-pressed={active === w}
                style={active === w ? { borderColor: 'var(--accent)' } : undefined}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-line"
                  style={{ background: rgbCss(w.rgb) }}
                />
                {w.name}
              </button>
            ))}
          </SwatchRow>
        )}
      </div>
    </div>,
    document.body
  );
};

export default BrightnessSheet;
