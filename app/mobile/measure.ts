import type { Page } from '@playwright/test';

// The phone checks (LA-STD-EXPERIENCE-R13, "On a phone nothing is cut off, overlapping, unreachable or too small to
// tap"): five measures of the page as drawn, each one helper here with its own test on a tiny fixture page
// (mobile/measure.spec.ts), so the checks themselves are proved. Each returns its findings: the element by role, name
// and selector, its box in viewport pixels, and what is wrong with it. The page's own code is installed once per
// document as window.__phone, so every helper measures with the same rules for what is shown and what clips.

/** One problem one check found on one element. */
export interface Finding {
  check: 'wide-page' | 'clipped-text' | 'small-target' | 'overlap' | 'unreachable';
  role: string;
  name: string;
  selector: string;
  box: { x: number; y: number; width: number; height: number };
  detail: string;
}

/** What a check skips: the contents of maps the Reader pans and zooms rather than scrolls (a CSS selector). */
export interface Options { pannable?: string }

declare global {
  interface Window { __phone?: Record<string, (pannable: string) => Finding[]> }
}

/** Installs the measuring code in the page, written as one function so it is sent whole. */
function install() {
  if (window.__phone) return;
  /** The smallest target a finger hits reliably, in CSS pixels. */
  const TARGET_SIZE = 44;
  const INTERACTIVE = [
    'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'summary', '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
    ...['button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'checkbox', 'radio', 'switch', 'option', 'slider', 'combobox']
      .map((r) => `[role="${r}"]`),
  ].join(', ');
  type Box = { left: number; top: number; right: number; bottom: number };

  const style = (el: Element) => getComputedStyle(el);
  const boxOf = (r: DOMRect | Box): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  const area = (b: Box) => Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
  const meet = (a: Box, b: Box): Box => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
  // The layout viewport: on a phone, content wider than the screen zooms the visual one out, so innerWidth grows with it.
  const vw = () => document.documentElement.clientWidth;
  const vh = () => document.documentElement.clientHeight;
  const viewport = (): Box => ({ left: 0, top: 0, right: vw(), bottom: vh() });
  /** An element's padding box: where its overflow is clipped. */
  const paddingBox = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    return { left: r.left + el.clientLeft, top: r.top + el.clientTop, right: r.left + el.clientLeft + el.clientWidth, bottom: r.top + el.clientTop + el.clientHeight };
  };
  const clipsAxis = (s: CSSStyleDeclaration, axis: 'x' | 'y') => ['hidden', 'clip'].includes(axis === 'x' ? s.overflowX : s.overflowY);
  const scrollsAxis = (s: CSSStyleDeclaration, axis: 'x' | 'y') => ['auto', 'scroll'].includes(axis === 'x' ? s.overflowX : s.overflowY);
  const root = (el: Element) => el === document.documentElement || el === document.body;

  /** Drawn, at least 2 px each way, and not hidden from the Reader (inert or aria-hidden). */
  const shown = (el: Element) => {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && !el.closest('[inert], [aria-hidden="true"]');
  };
  /** The open modal on top, if any: then only what is in it can be reached. */
  const modal = () => [...document.querySelectorAll('[aria-modal="true"], dialog')].filter((d) => (d.getAttribute('aria-modal') === 'true' || d.matches(':modal')) && shown(d)).at(-1) ?? null;
  const inPannable = (el: Element, pannable: string) => Boolean(pannable && el.closest(pannable));
  const interactive = (pannable: string) => {
    const top = modal();
    return [...document.querySelectorAll(INTERACTIVE)].filter((el) => shown(el) && (!top || top.contains(el)) && !inPannable(el, pannable));
  };

  /** The element whose overflow clips `node`: its parent, or for an absolutely placed one its containing block; null when fixed (the viewport clips it). */
  const clipParent = (node: Element): Element | null | undefined => {
    const pos = style(node).position;
    if (pos === 'fixed') return null;
    let p = node.parentElement;
    if (pos === 'absolute') {
      while (p && !root(p)) {
        const s = style(p);
        if (s.position !== 'static' || s.transform !== 'none' || s.contain.includes('paint') || s.contain.includes('layout')) break;
        p = p.parentElement;
      }
    }
    return p ?? undefined;
  };
  /** The fixed or sticky layer an element is drawn in, if any. */
  const layerOf = (el: Element) => {
    for (let n: Element | null = el; n && !root(n); n = n.parentElement) if (['fixed', 'sticky'].includes(style(n).position)) return n;
    return null;
  };

  /**
   * Where an element can be seen once every scrolling container that holds it is scrolled to it: clipped by every
   * hidden or clipped overflow on its way up (itself too, when `self`), by the viewport when it is fixed, and by the
   * document's own scroll range at the top. A pannable map stops the walk: what it holds is reached by panning. With
   * `seen`, a scrolling container clips as it stands rather than being scrolled to the element.
   */
  const reachBox = (el: Element, pannable: string, self = false, seen = false, from?: Box): Box => reach(el, pannable, self, seen, from).box;
  /** reachBox, with how far scrolling to the element moved it. */
  const reach = (el: Element, pannable: string, self: boolean, seen: boolean, from?: Box): { box: Box; shift: { x: number; y: number }; paged: { x: boolean; y: boolean } } => {
    let b = from ?? boxOf(el.getBoundingClientRect());
    const moved = { x: 0, y: 0 };
    // Bigger than a scrolling container that holds it, along an axis: read a window at a time, so that axis is not judged.
    const paged = { x: false, y: false };
    if (self) {
      const s = style(el); const p = paddingBox(el);
      if (clipsAxis(s, 'x')) b = { ...b, left: Math.max(b.left, p.left), right: Math.min(b.right, p.right) };
      if (clipsAxis(s, 'y')) b = { ...b, top: Math.max(b.top, p.top), bottom: Math.min(b.bottom, p.bottom) };
    }
    let node: Element = el;
    for (;;) {
      const p = clipParent(node);
      if (p === null) return { box: meet(b, viewport()), shift: moved, paged };
      if (!p || root(p) || (pannable && p.matches(pannable))) break;
      const s = style(p); const pb = paddingBox(p);
      for (const axis of ['x', 'y'] as const) {
        const [lo, hi] = axis === 'x' ? ['left', 'right'] as const : ['top', 'bottom'] as const;
        if (clipsAxis(s, axis) || (seen && scrollsAxis(s, axis))) {
          b = { ...b, [lo]: Math.max(b[lo], pb[lo]), [hi]: Math.min(b[hi], pb[hi]) };
        } else if (scrollsAxis(s, axis)) {
          // Scrolled to: the part before the container's scroll origin cannot be reached; the rest moves into its box.
          const origin = pb[lo] - (axis === 'x' ? p.scrollLeft : p.scrollTop);
          b = { ...b, [lo]: Math.max(b[lo], origin) };
          const size = b[hi] - b[lo];
          if (size > pb[hi] - pb[lo] + 1) paged[axis] = true;
          const shift = b[lo] < pb[lo] ? pb[lo] - b[lo] : b[hi] > pb[hi] ? -Math.min(b[lo] - pb[lo], b[hi] - pb[hi]) : 0;
          b = { ...b, [lo]: b[lo] + shift, [hi]: b[lo] + shift + size };
          moved[axis] += shift;
        }
      }
      node = p;
    }
    // The document: it scrolls over its own range unless its root clips that axis.
    const doc = document.scrollingElement ?? document.documentElement;
    const xClipped = clipsAxis(style(document.documentElement), 'x') || clipsAxis(style(document.body), 'x');
    const yClipped = clipsAxis(style(document.documentElement), 'y') || clipsAxis(style(document.body), 'y');
    return { box: meet(b, {
      left: -scrollX, right: xClipped ? vw() : doc.scrollWidth - scrollX,
      top: -scrollY, bottom: yClipped ? vh() : doc.scrollHeight - scrollY,
    }), shift: moved, paged };
  };

  /** A target that moves into view when it has focus, as a skip link does. Focus is put back. */
  const shownOnFocus = (el: HTMLElement, pannable: string) => {
    const before = document.activeElement as HTMLElement | null;
    el.focus({ preventScroll: true });
    const r = boxOf(el.getBoundingClientRect());
    const shown = document.activeElement === el && area(reachBox(el, pannable)) >= 0.5 * area(r);
    if (before && before !== document.body) before.focus({ preventScroll: true }); else el.blur();
    return shown;
  };
  /**
   * How far a tap lands on a target along the lines through its center, scrolled to the middle of the screen: its own
   * box, and a ::before or ::after hit box stretched past it. Covered at its center, it is judged by its box alone.
   */
  const hitSize = (el: Element) => {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const lands = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= vw() || y >= vh()) return false;
      const at = document.elementFromPoint(x, y);
      return Boolean(at && el.contains(at));
    };
    if (!lands(cx, cy)) return { width: r.width, height: r.height };
    const reach = (dx: number, dy: number) => { let n = 0; while (n < TARGET_SIZE && lands(cx + dx * (n + 1), cy + dy * (n + 1))) n++; return n; };
    return { width: Math.max(r.width, reach(-1, 0) + reach(1, 0) + 1), height: Math.max(r.height, reach(0, -1) + reach(0, 1) + 1) };
  };
  const roleOf = (el: Element) => {
    const r = el.getAttribute('role');
    if (r) return r;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const t = (el as HTMLInputElement).type;
      return ({ checkbox: 'checkbox', radio: 'radio', range: 'slider', button: 'button', submit: 'button', reset: 'button', search: 'searchbox' } as Record<string, string>)[t] ?? 'textbox';
    }
    return tag;
  };
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const nameOf = (el: Element) => {
    const label = el.getAttribute('aria-label');
    if (label) return label;
    const by = el.getAttribute('aria-labelledby');
    if (by) return by.split(/\s+/).map((id) => text(document.getElementById(id))).join(' ').trim();
    const labels = (el as HTMLInputElement).labels;
    if (labels?.length) return text(labels[0]);
    return text(el).slice(0, 80) || el.getAttribute('title') || el.getAttribute('placeholder') || el.querySelector('img[alt]')?.getAttribute('alt') || '';
  };
  const selectorOf = (el: Element) => {
    const parts: string[] = [];
    for (let n: Element | null = el; n && !root(n) && parts.length < 5; n = n.parentElement) {
      if (n.id) { parts.unshift(`#${CSS.escape(n.id)}`); break; }
      let s = n.tagName.toLowerCase();
      const classes = [...n.classList].slice(0, 2);
      if (classes.length) s += `.${classes.map((c) => CSS.escape(c)).join('.')}`;
      const parent = n.parentElement;
      const same = parent ? [...parent.children].filter((c) => c.tagName === n!.tagName && c.className === n!.className) : [];
      if (same.length > 1) s += `:nth-of-type(${[...parent!.children].filter((c) => c.tagName === n!.tagName).indexOf(n) + 1})`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const finding = (check: Finding['check'], el: Element, detail: string, box?: Box): Finding => {
    const r = box ?? boxOf(el.getBoundingClientRect());
    return {
      check, role: roleOf(el), name: nameOf(el), selector: selectorOf(el), detail,
      box: { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.right - r.left), height: Math.round(r.bottom - r.top) },
    };
  };
  const px = (n: number) => Math.round(n);

  window.__phone = {
    /** Content wider than the viewport: the page scrolls sideways, or something straddles the screen's edge. */
    widePage(pannable) {
      const doc = document.scrollingElement ?? document.documentElement;
      const found: Finding[] = [];
      const straddles = new Set<Element>();
      for (const el of document.querySelectorAll('body *')) {
        if (!shown(el) || el.closest('svg') && el.tagName.toLowerCase() !== 'svg' || inPannable(el, pannable)) continue;
        const b = reachBox(el, pannable, false, true);
        if (area(b) <= 0) continue;
        if ((b.right > vw() + 1 && b.left < vw()) || (b.left < -1 && b.right > 0)) straddles.add(el);
      }
      for (const el of straddles) {
        if (el.parentElement && straddles.has(el.parentElement)) continue;
        const r = el.getBoundingClientRect();
        found.push(finding('wide-page', el, `spans ${px(r.left)} to ${px(r.right)} px on a ${vw()} px screen`));
      }
      if (doc.scrollWidth > vw() + 1 && !found.length) found.push(finding('wide-page', document.body, `the page scrolls sideways to ${doc.scrollWidth} px`));
      // A reading pane that scrolls down and is pushed sideways too: its widest content is cut at the screen's edge
      // until the Reader thinks to swipe sideways. A pane meant to scroll sideways scrolls that way only.
      for (const el of document.querySelectorAll('body *')) {
        if (!shown(el) || inPannable(el, pannable)) continue;
        const s = style(el);
        if (!scrollsAxis(s, 'x') || !scrollsAxis(s, 'y') || el.scrollWidth <= el.clientWidth + 1 || el.scrollHeight <= el.clientHeight + 1) continue;
        const widest = [...el.querySelectorAll('*')].filter((c) => shown(c) && c.getBoundingClientRect().right > paddingBox(el).right + 1)
          .filter((c, _, all) => !all.includes(c.parentElement!));
        for (const c of (widest.length ? widest : [el]).slice(0, 5)) {
          found.push(finding('wide-page', c, `pushes its pane (${selectorOf(el)}) ${el.scrollWidth - el.clientWidth} px sideways`));
        }
      }
      return found.slice(0, 10);
    },

    /** Text cut off by a box that clips it, unless it ends in an ellipsis and its full text is the element's title or name. */
    clippedText(pannable) {
      const found: Finding[] = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('svg, input, textarea, select') || !shown(el) || inPannable(el, pannable)) continue;
        const nodes = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
        if (!nodes.length) continue;
        let t: Box | null = null;
        for (const n of nodes) {
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) {
            if (r.width === 0) continue;
            t = t ? { left: Math.min(t.left, r.left), top: Math.min(t.top, r.top), right: Math.max(t.right, r.right), bottom: Math.max(t.bottom, r.bottom) } : boxOf(r);
          }
        }
        if (!t) continue;
        // Where the text can be seen, scrolled to, against where it is drawn when scrolled the same way.
        const { box: seen, shift, paged } = reach(el, pannable, true, false, t);
        if (area(seen) <= 0) continue;
        t = { left: t.left + shift.x, right: t.right + shift.x, top: t.top + shift.y, bottom: t.bottom + shift.y };
        const cut = {
          x: paged.x ? 0 : Math.max(0, t.right - seen.right) + Math.max(0, seen.left - t.left),
          y: paged.y ? 0 : Math.max(0, t.bottom - seen.bottom) + Math.max(0, seen.top - t.top),
        };
        if (cut.x <= 2 && cut.y <= 2) continue;
        // An ellipsis (or a clamp) on the way up, with the whole text kept as a title or a name.
        let ellipsis = false;
        for (let n: Element | null = el; n && !root(n) && !ellipsis; n = n.parentElement) {
          const s = style(n);
          ellipsis = s.textOverflow === 'ellipsis' || (s.webkitLineClamp !== 'none' && s.webkitLineClamp !== '');
        }
        const whole = text(el);
        let named = false;
        for (let n: Element | null = el, i = 0; n && !root(n) && i < 5 && !named; n = n.parentElement, i++) {
          named = Boolean(n.getAttribute('title')?.includes(whole.slice(0, 40)) || n.getAttribute('aria-label')?.includes(whole.slice(0, 40)));
        }
        if (ellipsis && named) continue;
        const why = ellipsis ? 'ends in an ellipsis but its full text is not its title or name' : 'is cut off with no ellipsis';
        found.push(finding('clipped-text', el, `"${whole.slice(0, 50)}" ${why} (${px(cut.x)} px across, ${px(cut.y)} px down hidden)`));
      }
      return found;
    },

    /**
     * A target whose hit area is smaller than 44 x 44 px, but for a link inside a sentence. The hit area is where a tap
     * lands on it: its box, or wider where a ::before or ::after hit box reaches past it. A target smaller than 44 px is
     * scrolled to the middle of the screen and hit-tested along the lines through its center; every scroll position is
     * put back.
     */
    smallTargets(pannable) {
      const found: Finding[] = [];
      const scrolled = [...document.querySelectorAll('*')].filter((e) => e.scrollLeft || e.scrollTop).map((e) => [e, e.scrollLeft, e.scrollTop] as const);
      const page = { x: scrollX, y: scrollY };
      try {
        for (const el of interactive(pannable)) {
          const r = el.getBoundingClientRect();
          if (r.width >= TARGET_SIZE && r.height >= TARGET_SIZE) continue;
          if (roleOf(el) === 'link' && style(el).display === 'inline' && text(el.parentElement).length > text(el).length + 3) continue;
          const labels = (el as HTMLInputElement).labels;
          if (labels?.length && [...labels].some((l) => { const b = l.getBoundingClientRect(); return b.width >= TARGET_SIZE && b.height >= TARGET_SIZE; })) continue;
          const hit = hitSize(el);
          if (hit.width >= TARGET_SIZE && hit.height >= TARGET_SIZE) continue;
          found.push(finding('small-target', el, `${px(Math.max(r.width, hit.width))} x ${px(Math.max(r.height, hit.height))} px`, boxOf(el.getBoundingClientRect())));
        }
      } finally {
        for (const e of document.querySelectorAll('*')) if (e.scrollLeft || e.scrollTop) e.scrollTo({ left: 0, top: 0, behavior: 'instant' });
        for (const [e, left, top] of scrolled) e.scrollTo({ left, top, behavior: 'instant' });
        document.scrollingElement?.scrollTo({ left: page.x, top: page.y, behavior: 'instant' });
      }
      return found;
    },

    /**
     * Two targets drawn over each other, or a target a fixed or sticky layer still covers once it is scrolled as far into
     * view as it goes. Every scroll position is put back.
     */
    overlaps(pannable) {
      const found: Finding[] = [];
      const els = interactive(pannable);
      const labelled = (a: Element, b: Element) => Boolean((b as HTMLInputElement).labels && [...(b as HTMLInputElement).labels!].includes(a as HTMLLabelElement));
      // A focusable scrolling region is a place to scroll, not a target: what floats over it is judged against its contents.
      const region = (el: Element) => !el.matches(INTERACTIVE.replace('[tabindex]:not([tabindex="-1"]), ', ''))
        && (el.getAttribute('role') === 'region' || el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth);
      const seen = els.map((el) => reachBox(el, pannable, false, true));
      /** The boxes an element is drawn in: one per line for a link that wraps, clipped as it stands. */
      const lines = els.map((el, i) => {
        if (style(el).display !== 'inline') return [seen[i]];
        return [...el.getClientRects()].map((r) => meet(boxOf(r), seen[i])).filter((b) => area(b) > 0);
      });
      const layers = els.map(layerOf);
      // Only targets that share a row can overlap, so the pairs come from a sweep down the page: a page of 12,000 targets
      // has 78 million pairs, and comparing every one takes longer than the test may.
      const tops = lines.map((boxes) => Math.min(...boxes.map((x) => x.top)));
      const bottoms = lines.map((boxes) => Math.max(...boxes.map((x) => x.bottom)));
      const downThePage = els.map((_, i) => i).filter((i) => lines[i].length > 0).sort((p, q) => tops[p] - tops[q]);
      const pairs: [number, number][] = [];
      downThePage.forEach((p, at) => {
        for (let next = at + 1; next < downThePage.length && tops[downThePage[next]] <= bottoms[p]; next++) {
          const q = downThePage[next];
          pairs.push([Math.min(p, q), Math.max(p, q)]);
        }
      });
      pairs.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      for (const [i, j] of pairs) {
        const a = els[i], b = els[j];
        if (a.contains(b) || b.contains(a) || labelled(a, b) || labelled(b, a)) continue;
        // A layer over the flow is judged below, scrolled, rather than where the page happens to be scrolled now.
        if ((layers[i] === null) !== (layers[j] === null)) continue;
        if (region(a) || region(b)) continue;
        const m = lines[i].flatMap((x) => lines[j].map((y) => meet(x, y))).find((o) => o.right - o.left >= 2 && o.bottom - o.top >= 2);
        if (!m) continue;
        found.push(finding('overlap', a, `overlaps ${roleOf(b)} "${nameOf(b).slice(0, 40)}" (${selectorOf(b)}) by ${px(m.right - m.left)} x ${px(m.bottom - m.top)} px`, m));
      }
      const scrolled = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth).map((e) => [e, e.scrollLeft, e.scrollTop] as const);
      try {
        els.forEach((el, i) => {
          if (layers[i]) return;
          el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
          const r = el.getBoundingClientRect();
          const points = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy]);
          const over = points.map(([x, y]) => {
            if (x < 0 || y < 0 || x >= vw() || y >= vh()) return null;
            const hit = document.elementFromPoint(x, y);
            if (!hit || el.contains(hit) || hit.contains(el) || labelled(hit.closest('label') ?? hit, el)) return null;
            const layer = layerOf(hit);
            return layer && !layer.contains(el) ? layer : null;
          });
          const by = over.find(Boolean);
          if (by && (over[0] || over.filter(Boolean).length >= 2)) {
            found.push(finding('overlap', el, `covered by the ${style(by).position} ${selectorOf(by)} at ${over.filter(Boolean).length} of 5 points, scrolled as far as it goes`, boxOf(r)));
          }
        });
      } finally {
        for (const e of document.querySelectorAll('*')) if (e.scrollLeft || e.scrollTop) e.scrollTo({ left: 0, top: 0, behavior: 'instant' });
        document.scrollingElement?.scrollTo({ left: 0, top: 0, behavior: 'instant' });
        for (const [e, left, top] of scrolled) e.scrollTo({ left, top, behavior: 'instant' });
      }
      return found;
    },

    /** A target outside the viewport, or clipped away, that no scrolling container brings into view. */
    unreachable(pannable) {
      const found: Finding[] = [];
      for (const el of interactive(pannable)) {
        const r = boxOf(el.getBoundingClientRect());
        const { box: b, paged } = reach(el, pannable, false, false);
        if (paged.x || paged.y) continue;
        const share = area(b) / area(r);
        if (share >= 0.5 || shownOnFocus(el as HTMLElement, pannable)) continue;
        found.push(finding('unreachable', el, `only ${Math.round(share * 100)}% of it can be scrolled into view`, r));
      }
      return found;
    },
  };
}

async function run(page: Page, check: 'widePage' | 'clippedText' | 'smallTargets' | 'overlaps' | 'unreachable', options: Options): Promise<Finding[]> {
  await page.evaluate(install);
  return page.evaluate(([name, pannable]) => window.__phone![name](pannable), [check, options.pannable ?? ''] as const);
}

/** The page wider than the viewport: it scrolls sideways, or content straddles the screen's edge. */
export const widePage = (page: Page, options: Options = {}) => run(page, 'widePage', options);
/** Text clipped by its box without an ellipsis and its whole text as a title or name. */
export const clippedText = (page: Page, options: Options = {}) => run(page, 'clippedText', options);
/** A visible target whose hit area is smaller than 44 x 44 px, but for a link inside a sentence. */
export const smallTargets = (page: Page, options: Options = {}) => run(page, 'smallTargets', options);
/** Two targets over each other, or a fixed or sticky layer covering a target. */
export const overlaps = (page: Page, options: Options = {}) => run(page, 'overlaps', options);
/** A target outside the viewport that no scrolling container reaches. */
export const unreachable = (page: Page, options: Options = {}) => run(page, 'unreachable', options);

/** Every check, in the order they are reported. */
export const CHECKS = { widePage, clippedText, smallTargets, overlaps, unreachable };
