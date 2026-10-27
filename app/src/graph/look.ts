import { useEffect, useState } from 'react';
import { readMotion } from './motion';

// The graph's look as the canvas draws it (LA-EXP-C05): the stylesheet's colors and opacities,
// read from its tokens on the page, so the canvas follows the theme in light and dark exactly as
// the rest of the page does. A color token may be any CSS color (a `color-mix`, a theme's own), so
// each is read as the browser computes it, through a probe element.

export interface Look {
  paper: string; sheet: string; ink: string; muted: string; rule: string;
  steel: string; spark: string; sparkBg: string; warn: string; error: string; onMark: string;
  hoverRing: string; linkEdge: string;
  defineEdge: string; defineFill: string; designEdge: string; designFill: string;
  structuralEdge: string; structuralFill: string; fileEdge: string;
  /** How much the hover spotlight dims the rest, and how faint an unlit line then is. */
  spotlightDim: number; contextOpacity: number;
  /** How long the spotlight's fade takes, in ms: 0 under reduced motion. */
  fade: number;
  /** How wide the vignette of the paper at the canvas's edges is, in CSS pixels. */
  vignette: number;
}

const COLORS: Record<Exclude<keyof Look, 'spotlightDim' | 'contextOpacity' | 'fade' | 'vignette'>, string> = {
  paper: '--paper', sheet: '--sheet', ink: '--ink', muted: '--muted', rule: '--rule',
  steel: '--steel', spark: '--spark', sparkBg: '--spark-bg', warn: '--warn', error: '--error', onMark: '--on-mark',
  hoverRing: '--hover-ring', linkEdge: '--link-edge',
  defineEdge: '--g-define', defineFill: '--g-define-bg', designEdge: '--g-design', designFill: '--g-design-bg',
  structuralEdge: '--g-structural', structuralFill: '--g-structural-bg', fileEdge: '--g-file',
};

/** The look a page without a stylesheet draws in (the unit tests). */
export const PLAIN_LOOK: Look = {
  paper: '#F4F6F5', sheet: '#FFFFFF', ink: '#1D2830', muted: '#5A6870', rule: '#CBD3D6',
  steel: '#2E6A88', spark: '#B5512A', sparkBg: '#F8E8DF', warn: '#875C00', error: '#9E4320', onMark: '#fff',
  hoverRing: 'rgb(46 106 136 / 0.45)', linkEdge: '#B5512A',
  defineEdge: '#2E6A88', defineFill: '#E4EEF3', designEdge: '#B5512A', designFill: '#F8E8DF',
  structuralEdge: '#1D2830', structuralFill: '#FFFFFF', fileEdge: '#5A6870',
  spotlightDim: 0.5, contextOpacity: 0.35, fade: 0, vignette: 56,
};

/** Reads the look from the tokens as they apply at an element. */
export function readLook(at: HTMLElement): Look {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  at.appendChild(probe);
  const look = { ...PLAIN_LOOK };
  try {
    for (const [key, token] of Object.entries(COLORS) as [keyof typeof COLORS, string][]) {
      probe.style.color = '';
      probe.style.color = `var(${token})`;
      const value = getComputedStyle(probe).color;
      if (value) look[key] = value;
    }
    const style = getComputedStyle(at);
    const number = (token: string, fallback: number) => { const n = parseFloat(style.getPropertyValue(token)); return Number.isFinite(n) ? n : fallback; };
    look.spotlightDim = number('--spotlight-dim', PLAIN_LOOK.spotlightDim);
    look.contextOpacity = number('--context-opacity', PLAIN_LOOK.contextOpacity);
    look.fade = readMotion().duration;
    look.vignette = number('--vignette', PLAIN_LOOK.vignette);
  } finally {
    probe.remove();
  }
  return look;
}

/**
 * A number that changes whenever the theme may have: its stylesheet, the `data-theme` and
 * `data-mode` on the page's root, the system's light or dark, or reduced motion.
 */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(bump);
    observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode', 'style', 'class'] });
    observer?.observe(document.head, { childList: true, subtree: true, characterData: true });
    const queries = typeof window.matchMedia === 'function' ? ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)'].map((q) => window.matchMedia(q)) : [];
    for (const q of queries) q.addEventListener?.('change', bump);
    return () => {
      observer?.disconnect();
      for (const q of queries) q.removeEventListener?.('change', bump);
    };
  }, []);
  return version;
}
