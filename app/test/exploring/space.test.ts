import { describe, expect, it } from 'vitest';
import { RuleBroken } from '../../src/shell/prefs';
import { rememberPageInSpace } from '../../src/exploring/space/commands/remember-page-in-space';
import { noteSpacesListed } from '../../src/exploring/space/commands/note-spaces-listed';
import { NO_SPACE_MEMORY } from '../../src/exploring/space/model';
import { onPageOpenedRememberPageInSpace } from '../../src/exploring/space/policies';
import { spaceRepository } from '../../src/exploring/space/repository';
import { holdToRules } from '../../src/exploring/space/rules';

// The Space's commands (LA-EXP-CMD02, CMD20) and policy (LA-EXP-PO01), each saved through SpaceRepository.

describe('LA-EXP-INV20-T the Space commands keep the spaces through SpaceRepository', () => {
  it('remembers a page as its space\'s last page and the space as the one chosen, and how many spaces were listed', () => {
    rememberPageInSpace({ product: 'P', address: '/P-D?stage=erd' });
    expect(window.localStorage.getItem('lathe:space')).toBe('"P"');
    expect(JSON.parse(window.sessionStorage.getItem('lathe:space-pages')!)).toEqual({ P: '/P-D?stage=erd' });
    noteSpacesListed({ several: false });
    expect(window.localStorage.getItem('lathe:space-rail')).toBe('false');
    expect(spaceRepository.load()).toEqual({ chosen: 'P', pages: { P: '/P-D?stage=erd' }, several: false });
  });

  it('hears a page opened in a space, and nothing for a page outside every space', () => {
    onPageOpenedRememberPageInSpace(null, '/');
    expect(window.sessionStorage.getItem('lathe:space-pages')).toBeNull();
    onPageOpenedRememberPageInSpace('Q', '/Q');
    expect(spaceRepository.load().pages).toEqual({ Q: '/Q' });
  });

  it('drops a stored last page that is not a page of a space', () => {
    window.sessionStorage.setItem('lathe:space-pages', JSON.stringify({ P: '/P-D', Q: '/', R: 3 }));
    expect(spaceRepository.load().pages).toEqual({ P: '/P-D' });
  });
});

describe('LA-EXP-INV20-T A space\'s last page is a page of a space', () => {
  it('refuses another with its reason, and nothing is saved', () => {
    expect(() => holdToRules({ ...NO_SPACE_MEMORY, pages: { P: '/' } })).toThrow(RuleBroken);
    expect(() => holdToRules({ ...NO_SPACE_MEMORY, pages: { P: '/' } })).toThrow('The last page of space P, /, is not a page of a space.');
    expect(() => rememberPageInSpace({ product: 'P', address: '/' })).toThrow(RuleBroken);
    expect(window.sessionStorage.getItem('lathe:space-pages')).toBeNull();
  });
});
