import { describe, expect, it } from 'vitest';
import { cycleTab } from '../../src/exploring/tab-set/commands/cycle-tab';
import { duplicateTab } from '../../src/exploring/tab-set/commands/duplicate-tab';
import { keepCamera } from '../../src/exploring/tab-set/commands/keep-camera';
import { newTab } from '../../src/exploring/tab-set/commands/new-tab';
import { noteInTab } from '../../src/exploring/tab-set/commands/note-in-tab';
import { rememberStage } from '../../src/exploring/tab-set/commands/remember-stage';
import { replaceInTab } from '../../src/exploring/tab-set/commands/replace-in-tab';
import { activeTab, emptyTabs, NO_TABS, setOf, type TabSets } from '../../src/exploring/tab-set/model';
import { foldOrUnfoldNavSection } from '../../src/exploring/nav-row/commands/fold-or-unfold-nav-section';
import { openNavBranch } from '../../src/exploring/nav-row/commands/open-nav-branch';
import { navRowRepository } from '../../src/exploring/nav-row/repository';
import { noteSpacesListed } from '../../src/exploring/space/commands/note-spaces-listed';
import { spaceRepository } from '../../src/exploring/space/repository';
import { chooseChangesBaseline, turnHighlightChangesOnOrOff } from '../../src/exploring/session-settings/commands/handlers.generated';
import { markProductLookedAt } from '../../src/exploring/session-settings/commands/mark-product-looked-at';
import { resizeChat } from '../../src/exploring/session-settings/commands/resize-chat';
import { resizeWikiCard } from '../../src/exploring/session-settings/commands/resize-wiki-card';
import { CARD_MAX, CARD_MIN, CHAT_MAX, CHAT_MIN } from '../../src/exploring/session-settings/model';
import { sessionSettingsRepository } from '../../src/exploring/session-settings/repository';
import { DEFAULT_VIEW, hereOf, stepPlace } from '../../src/views/place';

// The commands of the Exploring domain that no other test drives as a use case or a policy's reaction: each is run on
// the aggregate as the page runs it (the repository for the browser's own memory, the whole tab sets for the tabs),
// and the state it leaves is read back.

const S = 'S';
/** A space's tab set, with the commands of the Tab set run on it. */
const on = <I,>(tabs: TabSets, command: (tabs: TabSets, input: I & { space: string }) => TabSets, input: I): TabSets => command(tabs, { ...input, space: S });
const open = (tabs: TabSets, address: string) => on(tabs, newTab, { address, view: DEFAULT_VIEW });
const three = () => open(open(open({ ...NO_TABS, sets: { [S]: emptyTabs() } }, '/A'), '/B'), '/C');
const keys = (tabs: TabSets) => setOf(tabs, S).tabs.map((t) => t.key);

describe('Fold or unfold a nav section', () => {
  it('LA-EXP-UC101-R01-T01 LA-EXP-UC101-FL-T A nav section the Reader folds stays folded, and unfolds again', () => {
    foldOrUnfoldNavSection({ section: 'tools', open: false });
    expect(navRowRepository.load().sections).toEqual({ tools: false });
    // Kept from one launch to the next: it is read back from the browser's storage.
    expect(window.localStorage.getItem('lathe:nav-sections')).toContain('tools');
    foldOrUnfoldNavSection({ section: 'tools', open: true });
    expect(navRowRepository.load().sections.tools).toBe(true);
  });
});

describe('Cycle through the tabs', () => {
  it('LA-EXP-UC102-R01-T01 LA-EXP-UC102-FL-T Cycling activates the next or previous tab and wraps around', () => {
    let tabs = three();
    const [a, b, c] = keys(tabs);
    expect(setOf(tabs, S).active).toBe(c);
    tabs = on(tabs, cycleTab, { step: 1 });
    expect(setOf(tabs, S).active).toBe(a);
    tabs = on(tabs, cycleTab, { step: 1 });
    expect(setOf(tabs, S).active).toBe(b);
    tabs = on(tabs, cycleTab, { step: -2 });
    expect(setOf(tabs, S).active).toBe(c);
    // One tab: nothing to cycle to.
    const alone = open({ ...NO_TABS, sets: { [S]: emptyTabs() } }, '/A');
    expect(on(alone, cycleTab, { step: 1 })).toBe(alone);
  });
});

describe('Duplicate a tab', () => {
  it('LA-EXP-UC103-R01-T01 LA-EXP-UC103-FL-T A duplicated tab is a copy beside the first, with its history and cameras, and active', () => {
    let tabs = three();
    const first = keys(tabs)[0];
    tabs = keepCamera(tabs, { place: `${S}/${first}`, stage: 'graph', camera: { framed: 'A', view: [1, 2, 3] } });
    tabs = on(tabs, duplicateTab, { key: first });
    const set = setOf(tabs, S);
    expect(set.tabs).toHaveLength(4);
    const copy = set.tabs[1];
    expect(set.active).toBe(copy.key);
    expect(copy.key).not.toBe(first);
    expect(copy.place).toEqual(set.tabs[0].place);
    expect(tabs.cameras.get(`${S}/${copy.key} graph`)).toEqual({ framed: 'A', view: [1, 2, 3] });
  });
});

describe('Resize the wiki card and the chat', () => {
  it('LA-EXP-UC104-R01-T01 LA-EXP-UC104-FL-T The wiki card stays within its limits, and reset brings back its default', () => {
    resizeWikiCard({ width: CARD_MAX + 500 });
    expect(sessionSettingsRepository.load().card.width).toBe(CARD_MAX);
    resizeWikiCard({ width: 1 });
    expect(sessionSettingsRepository.load().card.width).toBe(CARD_MIN);
    resizeWikiCard({ width: null });
    expect(sessionSettingsRepository.load().card.width).toBeNull();
  });

  it('LA-EXP-UC105-R01-T01 LA-EXP-UC105-FL-T The chat stays within its limits, and reset brings back its default', () => {
    resizeChat({ width: CHAT_MAX + 500 });
    expect(sessionSettingsRepository.load().chat.width).toBe(CHAT_MAX);
    resizeChat({ width: 1 });
    expect(sessionSettingsRepository.load().chat.width).toBe(CHAT_MIN);
    resizeChat({ width: null });
    expect(sessionSettingsRepository.load().chat.width).toBeNull();
  });
});

describe('Highlight changes and the Changes baseline', () => {
  it('LA-EXP-UC106-R01-T01 LA-EXP-UC106-FL-T Highlight changes turns on and off for the browser session', () => {
    expect(sessionSettingsRepository.load().changes.highlight).toBe(false);
    turnHighlightChangesOnOrOff({ on: true });
    expect(sessionSettingsRepository.load().changes.highlight).toBe(true);
    expect(window.sessionStorage.getItem('lathe:session-settings')).toContain('highlight');
    turnHighlightChangesOnOrOff({ on: false });
    expect(sessionSettingsRepository.load().changes.highlight).toBe(false);
  });

  it('LA-EXP-UC107-R01-T01 LA-EXP-UC107-FL-T The baseline is the last commit, the branch or when the Reader last looked, and no other', () => {
    for (const since of ['branch', 'looked', 'commit'] as const) {
      chooseChangesBaseline({ since });
      expect(sessionSettingsRepository.load().changes.since).toBe(since);
    }
    expect(() => chooseChangesBaseline({ since: 'yesterday' as never })).toThrow();
    expect(sessionSettingsRepository.load().changes.since).toBe('commit');
  });
});

describe("Note where a tab's page was", () => {
  it("LA-EXP-UC108-R01-T01 LA-EXP-UC108-FL-T A tab's entry keeps where the card was scrolled, which Back returns to", () => {
    let tabs = open({ ...NO_TABS, sets: { [S]: emptyTabs() } }, '/A');
    const key = setOf(tabs, S).active!;
    tabs = on(tabs, noteInTab, { key, note: { cardScroll: 420 } });
    let place = activeTab(setOf(tabs, S))!.place;
    expect(hereOf(place).note).toEqual({ cardScroll: 420 });
    // Another page, then back: the first entry still holds where it was.
    place = stepPlace({ ...place, history: [...place.history, { address: '/B', note: {} }], at: 1 }, 0);
    expect(hereOf(place).note).toEqual({ cardScroll: 420 });
  });
});

describe("The policies' reactions", () => {
  it('LA-EXP-PO20-T Once the products are listed, whether there are several is kept for the next launch', () => {
    expect(spaceRepository.load().several).toBe(true);
    noteSpacesListed({ several: false });
    expect(spaceRepository.load().several).toBe(false);
    noteSpacesListed({ several: true });
    expect(spaceRepository.load().several).toBe(true);
  });

  it('LA-EXP-PO21-T The branch to the page opens, and rows already open stay open', () => {
    navRowRepository.save({ folders: { 'dom:LA-MOD': true }, sections: {} });
    openNavBranch({ branch: ['dom:LA-EXP', 'kind:LA-EXP:command'] });
    expect(navRowRepository.load().folders).toEqual({ 'dom:LA-MOD': true, 'dom:LA-EXP': true, 'kind:LA-EXP:command': true });
  });

  it("LA-EXP-PO22-T A stage switched in place changes the active tab's entry, and leaves one history entry", () => {
    let tabs = open({ ...NO_TABS, sets: { [S]: emptyTabs() } }, '/A?stage=graph');
    tabs = on(tabs, replaceInTab, { address: '/A?stage=erd' });
    const place = activeTab(setOf(tabs, S))!.place;
    expect(place.history.map((e) => e.address)).toEqual(['/A?stage=erd']);
  });

  it('LA-EXP-PO23-T The stage chosen is kept for a place whose address names none', () => {
    expect(NO_TABS.stage).not.toBe('erd');
    const tabs = rememberStage(NO_TABS, { stage: 'erd' });
    expect(tabs.stage).toBe('erd');
    expect(rememberStage(tabs, { stage: 'erd' })).toBe(tabs);
  });

  it('LA-EXP-PO24-T The camera of the place left is kept under its place and stage', () => {
    const tabs = keepCamera(NO_TABS, { place: 'place', stage: 'trace', camera: { framed: 'LA-EXP-UC01', view: [4, 5, 6] } });
    expect(tabs.cameras.get('place trace')).toEqual({ framed: 'LA-EXP-UC01', view: [4, 5, 6] });
  });

  it('LA-EXP-PO25-T The moment a product was left is kept as its "since I last looked"', () => {
    const mark = { commit: 'abc123', digests: { 'LA-EXP-UC01': 'd1' }, at: '2026-11-12T10:00:00Z' };
    markProductLookedAt({ product: 'LA', mark });
    expect(sessionSettingsRepository.load().changes.looked).toEqual({ LA: mark });
  });
});
