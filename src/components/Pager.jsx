import { Children, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDisplay } from '../hooks/useDisplay';

/** Past this fraction of the width, letting go turns the page. */
const SWIPE_FRACTION = 0.18;
/** …or a quick flick, in px/ms, even if it didn't travel far. */
const FLICK_VELOCITY = 0.45;
/** Movement before we decide whether a gesture is a swipe or a tap/scroll. */
const SLOP_PX = 12;

/**
 * Full-screen pages you swipe between. Every page stays mounted, so swiping
 * back never shows a loading state and each page's data keeps flowing.
 *
 * The swipe is tracked with pointer events rather than native scroll
 * snapping. On this panel Chromium doesn't reliably turn a finger drag into
 * a scroll (the train list once needed hand-rolled touch scrolling for the
 * same reason), and pointer events arrive whether the touchscreen reports
 * real touches or emulates a mouse. `touch-action: pan-y` on the viewport
 * leaves vertical list scrolling to the browser and hands horizontal drags
 * to us.
 *
 * Pages move by setting scrollLeft on an overflow-hidden row, not with a
 * transform. The panel went blank white with a transformed (GPU-promoted)
 * track holding every glass card — most likely the Pi 4 running out of GPU
 * tile memory — while this scroll path is one it's known to draw correctly.
 *
 * The dots are an indicator, not controls — at 6px they'd be far below the
 * 48px tap-target floor, and swiping is the gesture. Arrow keys also page, for
 * desktop testing.
 */
const Pager = ({ children }) => {
  const pages = Children.toArray(children);
  const count = pages.length;
  const scrollerRef = useRef(null);
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

  /** Scrolls to the current page, offset by a live drag. */
  const place = (offsetPx, animate) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({
      left: index * el.clientWidth - offsetPx,
      behavior: animate ? 'smooth' : 'instant',
    });
  };

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    el?.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }, [index]);

  // Keep the page aligned if the viewport changes size (the desktop
  // 7-inch-panel preview toggles it).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() =>
      el.scrollTo({ left: index * el.clientWidth, behavior: 'instant' })
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [role="dialog"]')) return;
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step) setIndex((i) => Math.min(Math.max(i + step, 0), count - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  const goTo = (i) => {
    const next = Math.min(Math.max(i, 0), count - 1);
    if (next === index) place(0, true);
    else setIndex(next);
  };

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // React bubbles events from portals (the brightness sheet) through here
    // too; dragging its slider must not drag the page behind it.
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
      // Mostly vertical: it's a list scroll (or nothing), not a page swipe.
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null;
        return;
      }
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (e.clientX - d.lastX) / dt;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;

    // scrollLeft clamps at the first and last page on its own.
    place(dx, false);
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
    else goTo(index);
  };

  const onPointerCancel = () => {
    if (dragRef.current?.active) place(0, true);
    dragRef.current = null;
  };

  const onClickCapture = (e) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };


  return (
    <div className="relative h-full w-full">
      <div
        ref={scrollerRef}
        className="pager h-full w-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        {pages.map((page, i) => (
          <section key={page.key ?? i} className="h-full p-4">
            {page}
          </section>
        ))}
      </div>

      {count > 1 && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[5px] flex justify-center gap-1.5"
          aria-hidden="true"
        >
          {pages.map((page, i) => (
            <span
              key={page.key ?? i}
              className="h-1.5 rounded-full transition-all duration-300"
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
