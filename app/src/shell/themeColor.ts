import { useEffect } from 'react';

// The browser's own chrome (the status bar on a phone, the tab strip on some desktops) takes the
// color of the page's top bar: `<meta name="theme-color">` follows the `--sheet` token, so it
// follows the theme, whether it changes with the system's light or dark mode or with a theme set
// on the root element (an attribute, a class or inline tokens).

/** The color the theme gives the page's sheets, or null where it cannot be read. */
export function sheetColor(): string | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--sheet').trim();
  return value || null;
}

/** Keeps `<meta name="theme-color">` in step with the theme. */
export function useThemeColor() {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    const target = meta;
    const update = () => { const color = sheetColor(); if (color && target.content !== color) target.content = color; };
    update();
    const scheme = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    scheme?.addEventListener?.('change', update);
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(update) : null;
    observer?.observe(document.documentElement, { attributes: true });
    // A theme can also arrive as a stylesheet in the head (app/src/theme/apply.ts).
    observer?.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => { scheme?.removeEventListener?.('change', update); observer?.disconnect(); };
  }, []);
}
