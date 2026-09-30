import { Children, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDisplay } from '../hooks/useDisplay';
import { PagerContext } from '../context/pagerStore';

const pageOf = (el) => (el.clientWidth > 0 ? Math.round(el.scrollLeft / el.clientWidth) : 0);

const scrollToPage = (el, i, behavior = 'smooth') =>
  el?.scrollTo({ left: i * el.clientWidth, behavior });

/**
 * Full-screen pages you swipe between. Every page stays mounted, so swiping
 * back never shows a loading state and each page's data keeps flowing.
 *
 * The dots are an indicator, not controls — at 6px they'd be far below the
 * 48px tap-target floor, and swiping is the gesture. Buttons elsewhere can
 * jump pages through PagerContext. Arrow keys also page, for desktop testing.
 */
const Pager = ({ children }) => {
  const pages = Children.toArray(children);
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);
  const { isAsleep } = useDisplay();

  const onScroll = () => setIndex(pageOf(trackRef.current));

  // The same native smooth scroll the arrow keys use; snapping settles it.
  const goTo = useCallback((i) => scrollToPage(trackRef.current, i), []);
  const pager = useMemo(() => ({ index, goTo }), [index, goTo]);

  // Always wake to the first page: trains and weather are what a glance at
  // the wall is for.
  useEffect(() => {
    if (isAsleep) scrollToPage(trackRef.current, 0, 'instant');
  }, [isAsleep]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [role="dialog"]')) return;
      const el = trackRef.current;
      if (!el) return;
      const current = pageOf(el);
      if (e.key === 'ArrowRight') scrollToPage(el, Math.min(current + 1, pages.length - 1));
      if (e.key === 'ArrowLeft') scrollToPage(el, Math.max(current - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages.length]);

  return (
    <PagerContext.Provider value={pager}>
      <div className="relative h-full w-full">
        <div ref={trackRef} onScroll={onScroll} className="pager h-full w-full">
          {pages.map((page, i) => (
            <section key={page.key ?? i} className="h-full p-4">
              {page}
            </section>
          ))}
        </div>

        {pages.length > 1 && (
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
    </PagerContext.Provider>
  );
};

export default Pager;
