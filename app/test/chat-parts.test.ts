import { describe, expect, it } from 'vitest';
import { chipLabel, chipsContext } from '../src/chat/chips';
import { isImageType } from '../src/chat/images';
import { matchSkills, slashQuery } from '../src/chat/slash';
import { touchedInOrder } from '../src/chat/undo';
import type { ChatItem, ChatSkill } from '../src/chat/types';
import { workspace } from './fixtures/workspace';
import { recordIndexOf } from './read-view';

// The chat's smaller parts (LA-PLT-UC22-R01..R17): what a chip and the pointed-at context say, which turn commands undo
// names in order, the "/" list's matching, and the image types sent.

const tool = (name: string, input: string, status: 'done' | 'error' = 'done'): ChatItem => ({ kind: 'tool', id: name + input, name, label: name, summary: '', input, result: '', status });

describe('LA-PLT-UC22-R01-T03 the chips say the record and its title, and the context lists each record pointed at', () => {
  const index = recordIndexOf(workspace());
  it('names a record by ID and title, and a record the index lacks by its ID', () => {
    expect(chipLabel(index, 'DM-SHOP-UC01')).toBe('DM-SHOP-UC01 Add an item to the basket');
    expect(chipLabel(index, 'DM-SHOP-UC99')).toBe('DM-SHOP-UC99');
  });
  it('lists the records for Claude, and nothing for none', () => {
    expect(chipsContext(index, ['DM-SHOP-UC01'])).toContain('DM-SHOP-UC01 (use_case): Add an item to the basket');
    expect(chipsContext(index, [])).toBeNull();
    expect(chipsContext(index, ['DM-SHOP-UC99'])).toBeNull();
  });
});

describe('LA-PLT-UC27-R01-T02 undo names the records Claude\'s Lathe commands touched, in the order it ran them', () => {
  it('takes the ID of each finished Lathe command, and none from other tools, failed calls or clipped input', () => {
    const items = [
      tool('mcp__plugin_lathe_lathe__use_case_add_flow', '{"id":"X-UC01-F01"}'),
      tool('Bash', '{"id":"not-lathe"}'),
      tool('mcp__plugin_lathe_lathe__use_case_change_use_case', '{"id":"X-UC01","title":"t"}'),
      tool('mcp__plugin_lathe_lathe__use_case_remove_flow', '{"id":"X-UC01-F02"}', 'error'),
      tool('mcp__plugin_lathe_lathe__use_case_add_flow', '{"id":"X-UC01-F03", "steps": [… (4 more characters)'),
    ];
    expect(touchedInOrder(items)).toEqual(['X-UC01-F01', 'X-UC01']);
  });
});

describe('LA-PLT-UC22-R02-T02 the "/" list matches a leading slash and a name, by prefix first', () => {
  const skills: ChatSkill[] = [
    { name: 'compact', description: '', kind: 'command' },
    { name: 'lathe:check-and-fix', description: '', kind: 'skill' },
    { name: 'lathe:plan-tests', description: '', kind: 'skill' },
    { name: 'context', description: '', kind: 'command' },
  ];
  it('is open for a slash alone or a slash and a name being typed, and for nothing else', () => {
    expect(slashQuery('/')).toBe('');
    expect(slashQuery('/lathe:pl')).toBe('lathe:pl');
    expect(slashQuery('/compact now')).toBeNull();
    expect(slashQuery('say /compact')).toBeNull();
    expect(slashQuery('')).toBeNull();
  });
  it('lists names starting with the query first, then those with a word starting with it', () => {
    expect(matchSkills(skills, 'co').map((s) => s.name)).toEqual(['compact', 'context']);
    expect(matchSkills(skills, 'fix').map((s) => s.name)).toEqual(['lathe:check-and-fix']);
    expect(matchSkills(skills, 'tests').map((s) => s.name)).toEqual(['lathe:plan-tests']);
    expect(matchSkills(skills, '').length).toBe(4);
  });
});

describe('LA-PLT-UC22-R05-T03 only the image types Claude Code reads are sent', () => {
  it('takes PNG, JPEG, GIF and WebP', () => {
    expect(['image/png', 'image/jpeg', 'image/gif', 'image/webp'].every(isImageType)).toBe(true);
    expect(isImageType('image/svg+xml')).toBe(false);
    expect(isImageType('text/plain')).toBe(false);
  });
});
