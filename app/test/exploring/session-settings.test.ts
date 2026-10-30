import { describe, expect, it } from 'vitest';
import { RuleBroken } from '../../src/shell/prefs';
import { CARD_MAX, CHAT_MIN, DEFAULT_SESSION_SETTINGS } from '../../src/exploring/session-settings/model';
import { SETTINGS_KEY, sessionSettingsRepository } from '../../src/exploring/session-settings/repository';
import { holdToRules } from '../../src/exploring/session-settings/rules';
import { chooseGraphLayout } from '../../src/exploring/session-settings/commands/choose-graph-layout';
import { showOrHideMinimap } from '../../src/exploring/session-settings/commands/show-or-hide-minimap';
import { resizeWikiCard } from '../../src/exploring/session-settings/commands/resize-wiki-card';
import { showOrHideChat } from '../../src/exploring/session-settings/commands/show-or-hide-chat';
import { resizeChat } from '../../src/exploring/session-settings/commands/resize-chat';
import { turnHighlightChangesOnOrOff } from '../../src/exploring/session-settings/commands/turn-highlight-changes-on-or-off';
import { chooseChangesBaseline } from '../../src/exploring/session-settings/commands/choose-changes-baseline';
import { turnFollowOnOrOff } from '../../src/exploring/session-settings/commands/turn-follow-on-or-off';
import { markProductLookedAt } from '../../src/exploring/session-settings/commands/mark-product-looked-at';

// The Session settings' commands (LA-EXP-CMD09, CMD40–47): one per intent, each saved through SessionSettingsRepository.

const stored = () => JSON.parse(window.sessionStorage.getItem(SETTINGS_KEY) ?? 'null');

describe('LA-EXP-INV30-T the Session settings commands each keep one setting, in session storage', () => {
  it('keeps the graph\'s look, the card\'s and the chat\'s widths and the chat\'s open state', () => {
    chooseGraphLayout({ layout: 'nested' });
    showOrHideMinimap({ shown: true });
    resizeWikiCard({ width: 5000 });
    showOrHideChat({ shown: true });
    resizeChat({ width: 1 });
    expect(stored()).toMatchObject({ layout: 'nested', minimap: true, cardWidth: CARD_MAX, chat: true, chatWidth: CHAT_MIN });
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
    expect(window.sessionStorage.getItem(SETTINGS_KEY)).toBeNull();
  });
});

describe('LA-EXP-INV30-T The Session settings refuse a width outside its limits and a layout or baseline the app does not have', () => {
  it('refuses each with its reason, and nothing is saved', () => {
    expect(() => holdToRules({ ...DEFAULT_SESSION_SETTINGS, card: { width: 10 } })).toThrow(RuleBroken);
    expect(() => holdToRules({ ...DEFAULT_SESSION_SETTINGS, card: { width: 10 } })).toThrow("The wiki card's width 10 is outside 360–900 px.");
    expect(() => holdToRules({ ...DEFAULT_SESSION_SETTINGS, chat: { open: true, width: 2000 } })).toThrow("The chat's width 2000 is outside 320–760 px.");
    expect(() => holdToRules({ ...DEFAULT_SESSION_SETTINGS, graph: { layout: 'radial' as 'tree', minimap: false } })).toThrow('The graph has no layout "radial".');
    expect(() => holdToRules({ ...DEFAULT_SESSION_SETTINGS, changes: { ...DEFAULT_SESSION_SETTINGS.changes, since: 'ever' as 'commit' } })).toThrow('Highlight changes has no baseline "ever".');
    expect(window.sessionStorage.getItem(SETTINGS_KEY)).toBeNull();
  });
});
