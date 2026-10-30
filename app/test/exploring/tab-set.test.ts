import { describe, expect, it } from 'vitest';
import { RuleBroken } from '../../src/shell/prefs';
import { DEFAULT_VIEW } from '../../src/views/place';
import { closeTab } from '../../src/exploring/tab-set/commands/close-tab';
import { duplicateTab } from '../../src/exploring/tab-set/commands/duplicate-tab';
import { keepCamera } from '../../src/exploring/tab-set/commands/keep-camera';
import { moveInTab } from '../../src/exploring/tab-set/commands/move-in-tab';
import { newTab } from '../../src/exploring/tab-set/commands/new-tab';
import { rememberStage } from '../../src/exploring/tab-set/commands/remember-stage';
import { updateView } from '../../src/exploring/tab-set/commands/update-view';
import { NO_TABS } from '../../src/exploring/tab-set/model';
import { arrive, onPageOpenedMoveActiveTab } from '../../src/exploring/tab-set/policies';
import { keptCamera } from '../../src/exploring/tab-set/reads';
import { tabSetRepository } from '../../src/exploring/tab-set/repository';
import { holdToRules } from '../../src/exploring/tab-set/rules';
import { runTabSetCommand } from '../../src/exploring/tab-set/run';

// The Tab set's commands (LA-EXP-CMD04–08, CMD10, CMD23–28), run by runTabSetCommand through TabSetRepository.

const sets = () => JSON.parse(window.sessionStorage.getItem('lathe:tabs') ?? 'null');

describe('the Tab set commands keep the tabs through TabSetRepository', () => {
  it('keeps each space\'s set and the view last set for the session, and the stage from one launch to the next', () => {
    runTabSetCommand(moveInTab, { space: 'P', address: '/P-A?stage=graph', view: DEFAULT_VIEW });
    runTabSetCommand(newTab, { space: 'P', address: '/P-B?stage=erd', view: DEFAULT_VIEW });
    expect(sets().P.tabs.map((t: { key: string }) => t.key)).toEqual(['t1', 't2']);
    runTabSetCommand(updateView, { space: 'P', change: (v) => ({ ...v, depth: 3 }) });
    expect(JSON.parse(window.sessionStorage.getItem('lathe:place')!).depth).toBe(3);
    runTabSetCommand(updateView, { space: null, change: (v) => ({ ...v, depth: 2 }) });
    expect(tabSetRepository.load().view.depth).toBe(2);
    runTabSetCommand(rememberStage, { stage: 'trace' });
    expect(window.localStorage.getItem('lathe:stage')).toBe('"trace"');
    expect(tabSetRepository.load().stage).toBe('trace');
  });

  it('keeps a place\'s cameras in memory: a duplicate gets them, a closed tab forgets them', () => {
    runTabSetCommand(moveInTab, { space: 'P', address: '/P-A', view: DEFAULT_VIEW });
    runTabSetCommand(keepCamera, { place: 'P/t1', stage: 'graph', camera: { framed: 'f', view: { x: 1 } } });
    expect(keptCamera('P/t1', 'graph', 'f')).toEqual({ x: 1 });
    expect(keptCamera('P/t1', 'graph', 'other')).toBeNull();
    runTabSetCommand(duplicateTab, { space: 'P', key: 't1' });
    expect(keptCamera('P/t2', 'graph', 'f')).toEqual({ x: 1 });
    runTabSetCommand(closeTab, { space: 'P', key: 't1', home: '/P' });
    expect(keptCamera('P/t1', 'graph', 'f')).toBeNull();
    expect(window.sessionStorage.getItem('lathe:tabs')).not.toContain('camera');
  });

  it('works out a page opened while the page renders, and saves it once', () => {
    const arrival = arrive(NO_TABS.sets.P ?? { tabs: [], active: null }, 'P', '/P-A?stage=graph', 'load', null, DEFAULT_VIEW);
    expect(arrival.set.tabs).toHaveLength(1);
    expect(sets()).toBeNull();
    onPageOpenedMoveActiveTab(arrival);
    onPageOpenedMoveActiveTab(arrival);
    expect(sets().P.tabs).toHaveLength(1);
  });
});

describe('The Tab set (LA-EXP-INV07, LA-EXP-INV08) refuses a set with no active tab, and a place whose current entry is not in its history', () => {
  it('refuses each with its reason, and nothing is saved', () => {
    const place = { history: [{ address: '/A', note: {} }], at: 0, view: DEFAULT_VIEW };
    expect(() => holdToRules({ ...NO_TABS, sets: { P: { tabs: [{ key: 't1', place }], active: null } } })).toThrow(RuleBroken);
    expect(() => holdToRules({ ...NO_TABS, sets: { P: { tabs: [{ key: 't1', place }], active: null } } })).toThrow('The tab set of P has no active tab.');
    expect(() => holdToRules({ ...NO_TABS, sets: { P: { tabs: [{ key: 't1', place: { ...place, at: 4 } }], active: 't1' } } })).toThrow('Tab t1 of P stands on entry 4, which its history does not have.');
    expect(() => holdToRules({ ...NO_TABS, sets: { P: { tabs: [{ key: 't1', place: { ...place, history: [] } }], active: 't1' } } })).toThrow('Tab t1 of P has 0 history entries; a place keeps 1 to 50.');
    expect(() => runTabSetCommand(() => ({ ...NO_TABS, sets: { P: { tabs: [{ key: 't1', place }], active: 'x' } } }), {})).toThrow(RuleBroken);
    expect(window.sessionStorage.getItem('lathe:tabs')).toBeNull();
  });
});
