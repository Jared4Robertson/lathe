import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// The one way a table scrolls sideways. A table wider than its column scrolls inside this box, and while it does the
// box is a named stop on the Tab order, so a keyboard can scroll it (WCAG 2.1.1, LA-PAT-APP-UX-R10). Whether it scrolls
// depends on the fonts and the width, so it is measured, and a table that fits adds no stop. The box takes its name
// from its table's caption, which every site must give (test/table-scroll.test.tsx reads them all).

const CAPTION = ':scope > table > caption';

export function TableScroll({ stack = false, children }: { /** Lay the rows out stacked where the columns can't fit (.table-stack). */ stack?: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scrollingName, setScrollingName] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = box.current!;
    const measure = () => {
      const scrolls = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
      setScrollingName(scrolls ? el.querySelector(CAPTION)?.textContent ?? 'Table' : null);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    for (const child of el.children) watch.observe(child);
    return () => watch.disconnect();
  }, []);
  return (
    <div
      ref={box}
      className={stack ? 'table-scroll table-stack' : 'table-scroll'}
      {...(scrollingName === null ? {} : { tabIndex: 0, role: 'region', 'aria-label': `${scrollingName} (scrolls)` })}
    >
      {children}
    </div>
  );
}
