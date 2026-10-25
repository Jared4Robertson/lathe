import { describe, expect, it, vi } from 'vitest';
import { badgeFor, badgeText, dockMenuTemplate, parseErrorCount } from '../src/dock.ts';

describe('LA-DSK-T18 The Dock badge counts the focused product\'s check errors, and the Dock menu opens a new window', () => {
  it('shows the count, nothing at 0, and caps a large count', () => {
    expect(badgeText(0)).toBe('');
    expect(badgeText(1)).toBe('1');
    expect(badgeText(42)).toBe('42');
    expect(badgeText(999)).toBe('999');
    expect(badgeText(1000)).toBe('999+');
  });

  it('follows the focused window, else the window focused last, and counts an unreported window as 0', () => {
    const counts = new Map([[1, 3], [2, 0], [3, 12]]);
    expect(badgeFor(counts, 1, null)).toBe('3');
    expect(badgeFor(counts, 2, 1)).toBe('');
    // Another app is in front: the window focused last keeps the badge.
    expect(badgeFor(counts, null, 3)).toBe('12');
    expect(badgeFor(counts, null, null)).toBe('');
    expect(badgeFor(counts, 9, null)).toBe('');
    // Live reload: the window reports a new count, and the badge follows it.
    counts.set(1, 0);
    expect(badgeFor(counts, 1, null)).toBe('');
  });

  it('takes only a whole, non-negative count from the page', () => {
    expect(parseErrorCount(0)).toBe(0);
    expect(parseErrorCount(7)).toBe(7);
    for (const bad of [-1, 1.5, NaN, Infinity, '3', null, undefined, {}, [2], 10_000_000]) expect(parseErrorCount(bad)).toBeNull();
  });

  it('has New Window in the Dock menu, which runs Open Product Folder', () => {
    const newWindow = vi.fn();
    const menu = dockMenuTemplate({ newWindow });
    expect(menu.map((m) => m.label)).toEqual(['New Window']);
    (menu[0].click as () => void)();
    expect(newWindow).toHaveBeenCalledTimes(1);
  });
});
