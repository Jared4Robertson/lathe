import { describe, expect, it } from 'vitest';
import { RuleBroken } from '../../src/shell/prefs';
import { CARD_MAX, CHAT_MIN, DEFAULT_SESSION_SETTINGS } from '../../src/exploring/session-settings/model';
import { SESSION_SETTINGS_STORAGE } from '../../src/exploring/session-settings/model';
import { sessionSettingsRepository } from '../../src/exploring/session-settings/repository';
import { holdToRules } from '../../src/exploring/session-settings/rules';
import { chooseChangesBaseline, chooseGraphLayout, showOrHideAllLinks, showOrHideMinimap, turnFollowOnOrOff, turnHighlightChangesOnOrOff } from '../../src/exploring/session-settings/commands/handlers.generated';
import { resizeWikiCard } from '../../src/exploring/session-settings/commands/resize-wiki-card';
import { resizeChat } from '../../src/exploring/session-settings/commands/resize-chat';
import { markProductLookedAt } from '../../src/exploring/session-settings/commands/mark-product-looked-at';

// The Session settings' commands (LA-EXP-CMD09, CMD40–47): one per intent, each saved through SessionSettingsRepository.

const stored = () => JSON.parse(window.sessionStorage.getItem(SESSION_SETTINGS_STORAGE.key) ?? 'null');

describe('LA-EXP-INV30-T the Session settings commands each keep one setting, in session storage', () => {
  it('keeps the graph\'s look and the card\'s and the chat\'s widths', () => {
    chooseGraphLayout({ layout: 'nested' });
    showOrHideMinimap({ shown: true });
    showOrHideAllLinks({ shown: true });
    resizeWikiCard({ width: 5000 });
    resizeChat({ width: 1 });
    expect(stored()).toMatchObject({ layout: 'nested', minimap: true, allLinks: true, cardWidth: CARD_MAX, chatWidth: CHAT_MIN });
    resizeWikiCard({ width: null });
    expect(sessionSettingsRepository.load().card.width).toBeNull();
  });

  it('keeps Highlight changes, its baseline, Follow and the moment a product was looked at', () => {
    turnHighlightChangesOnOrOff({ on: true });
    chooseChangesBaseline({ since: 'branch' });
    turnFollowOnOrOff({ on: true });
    const mark = { commit: null, at: '2026-10-29T00:00:00Z', digests: {} };
    markProductLookedAt({ product: 'P', mark });
    expect(stored()).toMatchObject({ highlight: true, since: 'branch', follow: true, looked: { P: mark } });
  });

  it('saves nothing for a change that changes nothing', () => {
    chooseGraphLayout({ layout: 'tree' });
    expect(window.sessionStorage.getItem(SESSION_SETTINGS_STORAGE.key)).toBeNull();
  });
});

describe('LA-EXP-INV30-T The Session settings refuse a width outside its limits and a layout or baseline the app does not have', () => {
  it('refuses each with its reason, and nothing is saved', () => {
    expect(() => holdToRules({ ...DEFAULT_SESSION_SETTINGS, card: { width: 10 } })).toThrow(RuleBroken);
    expect(() => holdToRules({ ...DEFAULT_SESSION_SETTINGS, card: { width: 10 } })).toThrow("The wiki card's width 10 is outside 360–900 px.");
    expect(() => holdToRules({ ...DEFAULT_SESSION_SETTINGS, chat: { width: 2000 } })).toThrow("The chat's width 2000 is outside 320–760 px.");
    expect(() => holdToRules({ ...DEFAULT_SESSION_SETTINGS, graph: { layout: 'radial' as 'tree', minimap: false, allLinks: false } })).toThrow('The graph has no layout "radial".');
    expect(() => holdToRules({ ...DEFAULT_SESSION_SETTINGS, changes: { ...DEFAULT_SESSION_SETTINGS.changes, since: 'ever' as 'commit' } })).toThrow('Highlight changes has no baseline "ever".');
    expect(window.sessionStorage.getItem(SESSION_SETTINGS_STORAGE.key)).toBeNull();
  });
});
