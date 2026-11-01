import { describe, expect, it } from 'vitest';
import { RuleBroken } from '../../src/shell/prefs';
import { foldOrUnfoldNavEntry } from '../../src/exploring/nav-row/commands/fold-or-unfold-nav-entry';
import { foldOrUnfoldNavSection } from '../../src/exploring/nav-row/commands/fold-or-unfold-nav-section';
import { openNavBranch } from '../../src/exploring/nav-row/commands/open-nav-branch';
import { navRowRepository } from '../../src/exploring/nav-row/repository';
import { holdToRules } from '../../src/exploring/nav-row/rules';

// The Nav row's commands (LA-EXP-CMD03, CMD21, CMD22), each saved through NavRowRepository.

const folders = () => JSON.parse(window.sessionStorage.getItem('lathe:nav-folders') ?? 'null');

describe('LA-EXP-INV21-T the Nav row commands keep the rows through NavRowRepository', () => {
  it('opens a folded row with the branch below it that holds the page, and folds an open one', () => {
    foldOrUnfoldNavEntry({ key: 'b', branch: ['a', 'b', 'c'] });
    expect(folders()).toEqual({ b: true, c: true });
    foldOrUnfoldNavEntry({ key: 'b', branch: ['a', 'b', 'c'] });
    expect(folders()).toEqual({ b: false, c: true });
    foldOrUnfoldNavEntry({ key: 'x', branch: ['a'] });
    expect(folders()).toEqual({ b: false, c: true, x: true });
  });

  it('opens the branch to the page, and a section folds and opens, kept from one launch to the next', () => {
    openNavBranch({ branch: ['a', 'b'] });
    expect(folders()).toEqual({ a: true, b: true });
    foldOrUnfoldNavSection({ section: 'tools', open: false });
    expect(window.localStorage.getItem('lathe:nav-sections')).toBe('{"tools":false}');
    foldOrUnfoldNavSection({ section: 'tools', open: true });
    expect(navRowRepository.load().sections).toEqual({ tools: true });
  });

  it('drops a stored value of any other form', () => {
    window.sessionStorage.setItem('lathe:nav-folders', '{"a":1}');
    expect(navRowRepository.load().folders).toEqual({});
  });
});

describe('LA-EXP-INV21-T A nav row has a key and is open or folded', () => {
  it('refuses a row without a key, and one neither open nor folded, with their reasons', () => {
    expect(() => holdToRules({ folders: { '': true }, sections: {} })).toThrow(RuleBroken);
    expect(() => holdToRules({ folders: { '': true }, sections: {} })).toThrow('A folder row has no key.');
    expect(() => holdToRules({ folders: {}, sections: { tools: 'yes' as unknown as boolean } })).toThrow('The section tools is neither open nor folded.');
    expect(() => openNavBranch({ branch: [''] })).toThrow(RuleBroken);
    expect(window.sessionStorage.getItem('lathe:nav-folders')).toBeNull();
  });
});
