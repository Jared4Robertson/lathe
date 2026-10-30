import { describe, expect, it } from 'vitest';
import { RuleBroken } from '../../src/shell/prefs';
import { PANEL_LIMITS } from '../../src/platform/panel/model';
import { panelRepository } from '../../src/platform/panel/repository';
import { holdToRules } from '../../src/platform/panel/rules';
import { resizePanel } from '../../src/platform/panel/commands/resize-panel';
import { showOrHidePanel } from '../../src/platform/panel/commands/show-or-hide-panel';

// The Panel aggregate's commands (LA-PLT-CMD01, CMD02): each saves through PanelRepository, kept in local storage.

const stored = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? 'null');

describe('LA-PLT-INV30-T A panel\'s width stays within its limits: a resize is brought within them and a width outside them is refused', () => {
  it('resizes the nav within its limits, resets it to its default, and keeps both in local storage', () => {
    resizePanel({ panel: 'nav', width: 400.4 });
    expect(stored('lathe:nav-width')).toBe(400);
    resizePanel({ panel: 'nav', width: 9999 });
    expect(panelRepository.load().nav.width).toBe(PANEL_LIMITS.nav.max);
    resizePanel({ panel: 'nav', width: null });
    expect(stored('lathe:nav-width')).toBe(PANEL_LIMITS.nav.fallback);
  });

  it('shows and hides the nav, and reads a stored width outside the limits as the default', () => {
    showOrHidePanel({ panel: 'nav', shown: false });
    expect(stored('lathe:nav-collapsed')).toBe(true);
    showOrHidePanel({ panel: 'nav', shown: true });
    expect(panelRepository.load().nav.collapsed).toBe(false);
    window.localStorage.setItem('lathe:nav-width', '12');
    expect(panelRepository.load().nav.width).toBe(PANEL_LIMITS.nav.fallback);
  });

  it('refuses a width outside the limits with its reason, and nothing is saved', () => {
    const before = window.localStorage.getItem('lathe:nav-width');
    expect(() => holdToRules({ nav: { width: 10, collapsed: false } })).toThrow(RuleBroken);
    expect(() => holdToRules({ nav: { width: 10, collapsed: false } })).toThrow("The nav panel's width 10 is outside 256–560 px.");
    expect(window.localStorage.getItem('lathe:nav-width')).toBe(before);
  });
});
