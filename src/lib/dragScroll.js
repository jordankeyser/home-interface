/**
 * Finger-drag scrolling for a vertical list, as a React ref callback:
 *
 *   <div className="scroll-y" ref={dragScroll}>
 *
 * Chromium on the panel doesn't turn a finger drag into a scroll (the train
 * list has needed hand-rolled touch scrolling before for the same reason), so
 * lists scroll here from pointer events instead. Pointer events arrive
 * whether the touchscreen reports touches or emulates a mouse. `.scroll-y`
 * sets `touch-action: none` so the browser never claims the gesture halfway.
 *
 * Mostly-horizontal drags are ignored so they reach the page pager. A drag
 * that scrolled doesn't also count as a tap on the row it started on, and a
 * flick coasts to a stop.
 */

const SLOP_PX = 10;
/** Velocity kept per 16ms frame while coasting. */
const FRICTION = 0.95;
/** px/ms below which coasting stops. */
const MIN_VELOCITY = 0.02;
/** A finger that stopped this long before lifting doesn't flick. */
const FLICK_WINDOW_MS = 80;

export const dragScroll = (el) => {
  if (!el) return undefined;

  let drag = null;
  let raf = 0;
  let suppressClick = false;

  const stopCoasting = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stopCoasting();
    drag = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      top0: el.scrollTop,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      active: false,
    };
  };

  const onMove = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;

    if (!drag.active) {
      if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return;
      // Sideways: that's a page swipe, not a scroll.
      if (Math.abs(dx) >= Math.abs(dy)) {
        drag = null;
        return;
      }
      drag.active = true;
      el.setPointerCapture?.(e.pointerId);
    }

    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.velocity = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastT = e.timeStamp;
    el.scrollTop = drag.top0 - dy;
  };

  const onUp = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const { active, lastT } = drag;
    let velocity = e.timeStamp - lastT > FLICK_WINDOW_MS ? 0 : drag.velocity;
    drag = null;
    if (!active) return;

    // The click follows pointerup within the same task; clear on the next.
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 0);

    if (Math.abs(velocity) <= MIN_VELOCITY) return;
    let prev = performance.now();
    const coast = (now) => {
      const dt = now - prev;
      prev = now;
      el.scrollTop -= velocity * dt;
      velocity *= FRICTION ** (dt / 16);
      raf = Math.abs(velocity) > MIN_VELOCITY ? requestAnimationFrame(coast) : 0;
    };
    raf = requestAnimationFrame(coast);
  };

  const onCancel = () => {
    drag = null;
  };

  const onClick = (e) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('click', onClick, true);

  // React 19 calls a ref callback's returned function on unmount.
  return () => {
    stopCoasting();
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
    el.removeEventListener('click', onClick, true);
  };
};
