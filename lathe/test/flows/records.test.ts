// The flows of the records themselves (LA-PRD-UC37, UC38, UC39), walked through the package API (LA-IF06) as an Agent's
// script would: loadWorkspace on a product written as the store writes it (helpers.ts complete(), a record of nearly
// every kind). Each record has an ID of its own under one parent, which gives it its product and domain; records are
// related only by links the schema allows; and each record is one line of its kind's data file, whatever the order of
// the lines and fields. The refused paths are proved by the requirements' own tests (refused-once.test.ts, store/).
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadWorkspace, openStore, type SpecLink, type SpecRecord, type Workspace } from '../../src/index.ts';
import { build, complete, removeData, run } from '../helpers.ts';

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
  removeData();
});

const errorsOf = (ws: Workspace) => ws.problems.filter((p) => p.severity === 'error');
const byId = (ws: Workspace) => new Map(ws.records.map((r) => [r.id, r]));
const sortedRecords = (records: readonly SpecRecord[]) => [...records].sort((a, b) => a.id.localeCompare(b.id));
const linkKey = (l: SpecLink) => `${l.source} ${l.relation} ${l.target}`;
const sortedLinks = (links: readonly SpecLink[]) => links.map(linkKey).sort();

describe('The records\' own flows through the package API', () => {
  it('LA-PRD-UC37-FL-T every record loads with an ID no other record has, under one parent that gives it its product and domain', async () => {
    const root = await build(complete());
    // S01: the Agent's script loads the workspace.
    const ws = await loadWorkspace(root);
    expect(errorsOf(ws)).toEqual([]);
    const records = byId(ws);
    // An ID means one record: no two records share one, of any kind.
    expect(records.size).toBe(ws.records.length);
    expect(ws.records.length).toBeGreaterThan(50);

    let underParent = 0;
    for (const r of ws.records) {
      if (r.kind === 'product') {
        expect(r.parent, r.id).toBeNull();
        expect(r.product, r.id).toBe(r.id);
        continue;
      }
      expect(r.product, r.id).toBe('EX');
      if (r.kind === 'domain') expect(r.domain, r.id).toBe(r.id);
      if (r.parent === null) {
        // A record with no owner takes its product from its ID.
        expect(r.id.startsWith(`${r.product}-`), r.id).toBe(true);
        continue;
      }
      underParent++;
      // One parent, a record of the workspace, which gives it its product and domain.
      const up = records.get(r.parent);
      expect(up, `${r.id}'s parent ${r.parent}`).toBeDefined();
      expect(r.product, r.id).toBe(up!.product);
      if (r.kind !== 'domain') expect(r.domain, r.id).toBe(up!.domain);
      // Its ID fits its scope: it starts with its parent's, its domain's or its product's ID.
      const scopes = [r.parent, r.domain, r.product].filter((s): s is string => s !== null);
      expect(scopes.some((s) => r.id.startsWith(`${s}-`)), `${r.id} under ${r.parent}`).toBe(true);
    }
    expect(underParent).toBeGreaterThan(40);

    // A record deep in a domain has the product and domain of the chain above it.
    expect(records.get('EX-LEND-UC01-R01')).toMatchObject({ parent: 'EX-LEND-UC01', product: 'EX', domain: 'EX-LEND' });
    expect(records.get('EX-LEND-UC01')).toMatchObject({ parent: 'EX-LEND-CAP01', product: 'EX', domain: 'EX-LEND' });
    expect(records.get('EX-LEND-CAP01')).toMatchObject({ parent: 'EX-LEND', product: 'EX', domain: 'EX-LEND' });
  });

  it('LA-PRD-UC38-FL-T records are related only by links the schema allows between two records of one product, and an ID in text stays text', async () => {
    const root = await build(complete());
    // S01: the Agent's script loads the workspace.
    const ws = await loadWorkspace(root);
    expect(errorsOf(ws)).toEqual([]);
    const records = byId(ws);
    expect(ws.links.length).toBeGreaterThan(10);
    for (const l of ws.links) {
      const source = records.get(l.source);
      const target = records.get(l.target);
      expect(source, linkKey(l)).toBeDefined();
      expect(target, linkKey(l)).toBeDefined();
      // A relation the schema allows between the two kinds.
      const allowed = ws.relations.some((r) => r.relation === l.relation && r.source_kind === source!.kind && (r.target_kind === '*' || r.target_kind === target!.kind));
      expect(allowed, `${linkKey(l)} (${source!.kind} to ${target!.kind})`).toBe(true);
      // Both ends in one product.
      expect(source!.product, linkKey(l)).toBe(target!.product);
    }

    // The use case's goal names another record twice and its own ID; loaded again, the text is kept as written, it
    // makes no link, and no check reports the IDs.
    const goal = 'A member takes a free tool home; EX-LEND-A1 holds the loan, as EX-LEND-A1 says, and EX-LEND-UC01 is this use case. `EX-LEND-V99` is no record.';
    const store = await openStore(root);
    try {
      await run(store, 'use-case change-use-case', { id: 'EX-LEND-UC01', goal });
    } finally {
      await store.close();
    }
    const again = await loadWorkspace(root);
    expect(errorsOf(again)).toEqual([]);
    expect(byId(again).get('EX-LEND-UC01')?.fields.goal).toBe(goal);
    expect(sortedLinks(again.links)).toEqual(sortedLinks(ws.links));
    expect(again.problems.filter((p) => /EX-LEND-V99/.test(p.message))).toEqual([]);
    expect(again.problems.map((p) => `${p.check} ${p.record}: ${p.message}`).sort()).toEqual(ws.problems.map((p) => `${p.check} ${p.record}: ${p.message}`).sort());
  });

  it('LA-PRD-UC39-FL-T LA-PRD-UC39-R02-T01 each record is one line of its kind\'s data file, and the same data with its lines and fields reversed, next to a README, means the same', async () => {
    const root = await build(complete());
    // S01: the Agent's script loads the workspace from the data files.
    const ws = await loadWorkspace(root);
    expect(errorsOf(ws)).toEqual([]);
    const data = path.join(root, 'data');
    const files = readdirSync(data).filter((f) => f.endsWith('.jsonl'));
    const lines = new Map(files.map((f) => {
      const text = readFileSync(path.join(data, f), 'utf8');
      expect(text.endsWith('\n'), f).toBe(true);
      return [f, text.slice(0, -1).split('\n')] as const;
    }));
    // Every line is one JSON object.
    for (const [f, rows] of lines) {
      for (const [at, line] of rows.entries()) {
        const row: unknown = JSON.parse(line);
        expect(typeof row === 'object' && row !== null && !Array.isArray(row), `${f}:${at + 1}`).toBe(true);
      }
    }
    // Each record is exactly one line of its kind's file.
    for (const r of ws.records) {
      const rows = lines.get(`${r.kind}.jsonl`);
      expect(rows, `${r.kind}.jsonl for ${r.id}`).toBeDefined();
      expect(rows!.filter((line) => (JSON.parse(line) as { id?: unknown }).id === r.id), r.id).toHaveLength(1);
    }

    // The same data, each file's lines in reverse order and each line's fields in reverse order, with a README in the
    // data folder: the same records, links, coverage and problems.
    const copy = mkdtempSync(path.join(tmpdir(), 'lathe-reversed-'));
    temps.push(copy);
    cpSync(root, copy, { recursive: true });
    for (const [f, rows] of lines) {
      const reversed = [...rows].reverse().map((line) => JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(line) as Record<string, unknown>).reverse())));
      writeFileSync(path.join(copy, 'data', f), `${reversed.join('\n')}\n`);
    }
    writeFileSync(path.join(copy, 'data', 'README.md'), '# Data\n\nThese files are the product\'s records, one a line.\n');
    expect(readFileSync(path.join(copy, 'data', files[0]), 'utf8')).not.toBe(readFileSync(path.join(data, files[0]), 'utf8'));
    const mirrored = await loadWorkspace(copy);
    expect(errorsOf(mirrored)).toEqual([]);
    expect(sortedRecords(mirrored.records)).toEqual(sortedRecords(ws.records));
    expect(sortedLinks(mirrored.links)).toEqual(sortedLinks(ws.links));
    expect(mirrored.coverage).toEqual(ws.coverage);
    expect(mirrored.problems).toEqual(ws.problems);
    // The complete library has no problem either way: the README is not read as data.
    expect(mirrored.problems).toEqual([]);
  });
});
