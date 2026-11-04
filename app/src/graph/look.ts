import { useEffect, useState } from 'react';
import { readMotion } from './motion';

// The graph's look as the canvas draws it (LA-UI92): the stylesheet's colors and opacities,
// read from its tokens on the page, so the canvas follows the theme in light and dark exactly as
// the rest of the page does. A color token may be any CSS color (a `color-mix`, a theme's own), so
// each is read as the browser computes it, through a probe element.

export interface Look {
  paper: string; sheet: string; ink: string; muted: string; rule: string;
  steel: string; sparkBg: string; warn: string; error: string; onMark: string;
  hoverRing: string; linkEdge: string;
  discoveryEdge: string; discoveryFill: string; domainModelEdge: string; domainModelFill: string; useCasesEdge: string; useCasesFill: string;
  interfaceDesignEdge: string; interfaceDesignFill: string; technicalSpecificationEdge: string; technicalSpecificationFill: string;
  testPlanEdge: string; testPlanFill: string;
  structuralEdge: string; structuralFill: string;
  /** The live marks' colors (changes/marks.ts): a new record's glow and dot, a changed record's dot, a removed record's ghost. */
  changeNew: string; changeChanged: string; changeGone: string;
  /** How much the hover spotlight dims the rest, and how faint an unlit line then is. */
  spotlightDim: number; contextOpacity: number;
  /** The focus fade (fade.ts): how strongly a box outside the focus's subtree is drawn, and an ancestor kept as a trail in Nested. */
  focusFade: number; focusTrail: number;
  /** How long the spotlight's fade takes, in ms: 0 under reduced motion. */
  fade: number;
  /** How wide the vignette of the paper at the canvas's edges is, in CSS pixels. */
  vignette: number;
}

const COLORS: Record<Exclude<keyof Look, 'spotlightDim' | 'contextOpacity' | 'focusFade' | 'focusTrail' | 'fade' | 'vignette'>, string> = {
  paper: '--paper', sheet: '--sheet', ink: '--ink', muted: '--muted', rule: '--rule',
  steel: '--steel', sparkBg: '--spark-bg', warn: '--warn', error: '--error', onMark: '--on-mark',
  hoverRing: '--hover-ring', linkEdge: '--link-edge',
  discoveryEdge: '--g-discovery', discoveryFill: '--g-discovery-bg',
  domainModelEdge: '--g-domain-model', domainModelFill: '--g-domain-model-bg', useCasesEdge: '--g-use-cases', useCasesFill: '--g-use-cases-bg',
  interfaceDesignEdge: '--g-interface-design', interfaceDesignFill: '--g-interface-design-bg',
  technicalSpecificationEdge: '--g-technical-specification', technicalSpecificationFill: '--g-technical-specification-bg',
  testPlanEdge: '--g-test-plan', testPlanFill: '--g-test-plan-bg',
  structuralEdge: '--g-structural', structuralFill: '--g-structural-bg',
  changeNew: '--change-new', changeChanged: '--change-changed', changeGone: '--change-gone',
};

/** The look a page without a stylesheet draws in (the unit tests). */
export const PLAIN_LOOK: Look = {
  paper: '#F4F6F5', sheet: '#FFFFFF', ink: '#1D2830', muted: '#5A6870', rule: '#CBD3D6',
  steel: '#2E6A88', sparkBg: '#F8E8DF', warn: '#875C00', error: '#9E4320', onMark: '#fff',
  hoverRing: 'rgb(46 106 136 / 0.45)', linkEdge: '#B5512A',
  discoveryEdge: '#75640E', discoveryFill: '#F4EFD8',
  domainModelEdge: '#2E6A88', domainModelFill: '#E4EEF3', useCasesEdge: '#2F7148', useCasesFill: '#E2F1E7',
  interfaceDesignEdge: '#6A4C9C', interfaceDesignFill: '#EEE8F6', technicalSpecificationEdge: '#B5512A', technicalSpecificationFill: '#F8E8DF',
  testPlanEdge: '#A3365F', testPlanFill: '#F7E4EC',
  structuralEdge: '#1D2830', structuralFill: '#FFFFFF',
  changeNew: '#2F7148', changeChanged: '#875C00', changeGone: '#A83523',
  spotlightDim: 0.5, contextOpacity: 0.35, focusFade: 0.25, focusTrail: 0.45, fade: 0, vignette: 56,
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
    look.focusFade = number('--focus-fade', PLAIN_LOOK.focusFade);
    look.focusTrail = number('--focus-trail', PLAIN_LOOK.focusTrail);
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
