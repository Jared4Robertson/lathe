// IDs written in a record's text are plain text, whatever their prefix or formatting: the engine reads no citations
// out of text, so lathe.config.json has no idPrefixes and no check reports an ID in text. Records link only through
// the link tables.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, loadWorkspace, type Workspace } from '../src/index.ts';
import { loadData, removeData, writeData, type Data } from './helpers.ts';

/** A product whose records name IDs in their text in every way the Markdown format once read as citations. */
const data = (): Data => ({
  product: [{ id: 'CR', title: 'Citations', description: 'Its domain is CR-D, and `CR` is its code.' }],
  domain: [{ id: 'CR-D', title: 'Domain', product_id: 'CR', description: 'Plain CR and CR-D, and `CR-D` in a code span.' }],
  use_case: [
    { id: 'CR-D-UC01', title: 'Cite', domain_id: 'CR-D', goal: 'It follows CR-D-UC02, STD-CODE-R01 and SYS-AUTH, and `CR-D-UC02` again.' },
    { id: 'CR-D-UC02', title: 'Be cited', domain_id: 'CR-D', goal: 'Text.', notes: 'A fence:\n```\nCR-D-UC09\n```\nand ` CR-D-UC08 ` and `CR-D-UC07 x`.' },
  ],
});

let ws: Workspace;
beforeAll(async () => { ws = await loadData(data()); });
afterAll(removeData);
const text = (id: string) => Object.values(ws.records.find((r) => r.id === id)!.fields).filter((v) => typeof v === 'string').join('\n');

describe('IDs in text are plain text', () => {
  it("LA-AUT-T48 A token that is the ID of a record is plain text, whatever its prefix: it is no link", () => {
    expect(text('CR-D-UC01')).toContain('CR-D-UC02');
    expect(ws.links).toEqual([]);
  });

  it("LA-AUT-T49 A token starting with a product's or domain's ID and '-' is plain text, and no problem when no record has it", () => {
    expect(text('CR-D-UC02')).toContain('CR-D-UC09');
    expect(ws.problems.filter((p) => /CR-D-UC0[789]/.test(p.message))).toEqual([]);
  });

  it('LA-AUT-T50 A token with any other prefix, such as STD- or SYS-, is plain text too', () => {
    expect(text('CR-D-UC01')).toContain('STD-CODE-R01 and SYS-AUTH');
    expect(ws.problems.filter((p) => p.message.includes('STD-') || p.message.includes('SYS-'))).toEqual([]);
  });

  it('LA-AUT-T51 A bare product or domain ID in plain text is kept as written', () => {
    expect(ws.records.find((r) => r.id === 'CR-D')!.fields.description).toBe('Plain CR and CR-D, and `CR-D` in a code span.');
  });

  it('LA-AUT-T52 A bare product or domain ID in a code span is kept as written, code span and all', () => {
    expect(ws.records.find((r) => r.id === 'CR')!.fields.description).toContain('`CR` is its code');
  });

  it('LA-AUT-T53 No ID in text, known or not, is a warning: Lathe has no check that reads text for IDs', async () => {
    expect(ws.problems.filter((p) => p.check === 'unknown-id-in-prose')).toEqual([]);
    expect(ws.problems.filter((p) => p.message.includes('CR-D-UC02') && p.record !== 'CR-D-UC02')).toEqual([]);
  });

  it('LA-AUT-T54 lathe.config.json takes no idPrefixes: it is an unknown setting', async () => {
    const root = writeData(data());
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ idPrefixes: ['STD', 'SYS'] }));
    expect(() => loadConfig(root)).toThrow(/unknown setting "idPrefixes"\. The settings are data\./);
    await expect(loadWorkspace(root)).rejects.toThrow(/idPrefixes/);
  });

  it('LA-AUT-T55 Code spans and fences in text are stored exactly as written, spacing included', () => {
    expect(ws.records.find((r) => r.id === 'CR-D-UC02')!.fields.notes).toBe('A fence:\n```\nCR-D-UC09\n```\nand ` CR-D-UC08 ` and `CR-D-UC07 x`.');
  });
});
