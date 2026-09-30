import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { brightnessPct, isOn } from '../../../lib/haEntities';

/** Wi-Fi bulbs choke on a command per pointermove; this is plenty responsive. */
const SEND_EVERY_MS = 350;
const PRESETS = [25, 50, 75, 100];

const clamp = (n) => Math.min(100, Math.max(0, n));

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
 * Portalled to <body>: the cards' backdrop-filter and the panel's burn-in
 * transform both trap `position: fixed` inside them, so rendered in place
 * this would be clipped to the devices card.
 */
const BrightnessSheet = ({ entity, name, onChange, onClose }) => {
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
      <div className="card w-full max-w-[640px] p-6">
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
          className="card-inset relative mt-6 h-20 cursor-pointer overflow-hidden outline-none focus-visible:border-accent"
          // The finger drags the slider, never the page behind it.
          style={{ touchAction: 'none' }}
        >
          <div
            className="absolute inset-y-0 left-0 bg-lamp"
            style={{ width: `${value}%`, opacity: 0.35 + (value / 100) * 0.55 }}
          />
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
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BrightnessSheet;
