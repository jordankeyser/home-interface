import { Children, useEffect, useRef, useState } from 'react';
import { useDisplay } from '../hooks/useDisplay';

/** Past this fraction of the width, a swipe turns the page. */
const SWIPE_FRACTION = 0.15;
/** …or a quick flick, in px/ms, even if it didn't travel far. */
const FLICK_VELOCITY = 0.45;
/** Movement before we decide whether a gesture is a swipe or a tap/scroll. */
const SLOP_PX = 10;

/**
 * Full-screen pages you swipe between.
 *
 * Only the current page is displayed; the others stay mounted but hidden, so
 * their data keeps flowing and switching back is instant. There is no
 * side-by-side scrolling row or sliding transform: both of those left the
 * Pi's panel blank white, and a single page laid out on its own is exactly
 * how the dashboard has always rendered there.
 *
 * Swipes are read from pointer events — Chromium on the panel doesn't turn
 * finger drags into scrolls — and `touch-action: none` keeps the browser from
 * claiming the gesture. Vertical drags are left to the lists (see
 * lib/dragScroll). Arrow keys also page, for desktop testing.
 *
 * The dots are an indicator, not controls — at 6px they'd be far below the
 * 48px tap-target floor, and swiping is the gesture.
 */
const Pager = ({ children }) => {
  const pages = Children.toArray(children);
  const count = pages.length;
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [index, setIndex] = useState(0);
  const { isAsleep } = useDisplay();

  // Always wake to the first page: trains and weather are what a glance at
  // the wall is for. Adjusting state during render is React's pattern for
  // resetting on a prop change.
  const [wasAsleep, setWasAsleep] = useState(isAsleep);
  if (isAsleep !== wasAsleep) {
    setWasAsleep(isAsleep);
    if (isAsleep) setIndex(0);
  }

  const goTo = (i) => setIndex(Math.min(Math.max(i, 0), count - 1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [role="dialog"]')) return;
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step) setIndex((i) => Math.min(Math.max(i + step, 0), count - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // React bubbles events from portals (the brightness sheet) through here
    // too; dragging its slider must not turn the page behind it.
    if (!e.currentTarget.contains(e.target)) return;
    dragRef.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      lastX: e.clientX,
      lastT: e.timeStamp,
      velocity: 0,
      active: false,
    };
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;

    if (!d.active) {
      if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return;
      // Mostly vertical: a list scroll (or nothing), not a page swipe.
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null;
        return;
      }
      d.active = true;
    }

    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (e.clientX - d.lastX) / dt;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.id !== e.pointerId || !d.active) return;

    // The tap that ends a swipe must not also toggle the tile it started on.
    // The click follows pointerup within the same task, so clear on the next.
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    const dx = e.clientX - d.x0;
    const threshold = e.currentTarget.clientWidth * SWIPE_FRACTION;
    if (dx < -threshold || d.velocity < -FLICK_VELOCITY) goTo(index + 1);
    else if (dx > threshold || d.velocity > FLICK_VELOCITY) goTo(index - 1);
  };

  const onPointerCancel = () => {
    dragRef.current = null;
  };

  const onClickCapture = (e) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="pager relative h-full w-full"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onClickCapture}
    >
      {pages.map((page, i) => (
        <section key={page.key ?? i} hidden={i !== index} className="h-full p-4">
          {page}
        </section>
      ))}

      {count > 1 && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[5px] flex justify-center gap-1.5"
          aria-hidden="true"
        >
          {pages.map((page, i) => (
            <span
              key={page.key ?? i}
              className="h-1.5 rounded-full"
              style={{
                width: i === index ? '1.25rem' : '0.375rem',
                backgroundColor: i === index ? 'var(--fg-muted)' : 'var(--line-strong)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Pager;
