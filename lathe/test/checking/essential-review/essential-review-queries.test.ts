// The Essential review read (LA-CHK-RM12, LA-CHK-QRY13): a product's essential records alone, grouped by domain, worked
// out from the rows on every read through the read model's reader; and the skill that has an Agent read them with
// fresh eyes before it proposes an essential change.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LIST_ESSENTIAL_RECORDS } from '../../../src/checking/essential-review/queries.ts';
import type { EssentialReview } from '../../../src/checking/essential-review/read-model.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import type { ReadView } from '../../../src/platform/data/rules.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { complete, writeData } from '../../helpers.ts';

const open: Store[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

async function view(): Promise<ReadView> {
  const store = await openStore(writeData(complete()), { latheDataDir: null });
  open.push(store);
  return { schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id) };
}

describe('LA-CHK-UC09-R01-T01 A product\'s essential records are listed alone, by domain, with their kind, title and lead text', () => {
  it('lists the Lending domain\'s essential records in ID order, then those in no domain, and refuses an unknown product', async () => {
    const data = await view();
    const review = runQuery(data, LIST_ESSENTIAL_RECORDS, { product_id: 'EX' }) as EssentialReview;
    expect(review.domains.map((d) => [d.domain, d.title])).toEqual([['EX-LEND', 'Lending'], [null, 'In no domain']]);
    expect(review.domains[0].records.map((r) => r.id)).toEqual([
      'EX-LEND', 'EX-LEND-A1', 'EX-LEND-A1-SR01', 'EX-LEND-A2', 'EX-LEND-CAP01', 'EX-LEND-CMD01', 'EX-LEND-CMD02', 'EX-LEND-CMD03', 'EX-LEND-DS01',
      'EX-LEND-EN01', 'EX-LEND-EN02', 'EX-LEND-EN03', 'EX-LEND-EV01', 'EX-LEND-EV02', 'EX-LEND-INV01', 'EX-LEND-PO01', 'EX-LEND-QRY01', 'EX-LEND-RM01',
      'EX-LEND-SP01', 'EX-LEND-TD01', 'EX-LEND-TM01', 'EX-LEND-UC01', 'EX-LEND-UC01-FL', 'EX-LEND-UC01-FL-S01', 'EX-LEND-UC01-FL-S02', 'EX-LEND-UC01-R01',
      'EX-LEND-UC02', 'EX-LEND-UC02-FL', 'EX-LEND-UC02-FL-S01', 'EX-LEND-UC02-R01',
    ]);
    // No technical record, endpoint, pattern, slot or test; an API requirement of an internal API is accidental.
    expect(review.domains[1].records.map((r) => r.id)).toEqual(['EX', 'EX-BO01', 'EX-IF01', 'EX-INT01', 'EX-INT02', 'EX-V01', 'EX-V01-R01', 'EX-VO01', 'EX-VO01-C01']);
    expect(review.count).toBe(39);
    expect(review.domains[0].records.find((r) => r.id === 'EX-LEND-UC01')).toEqual({ id: 'EX-LEND-UC01', kind: 'use_case', label: 'Use case', title: 'Borrow a tool', lead: 'A member takes a free tool home.' });
    const text = LIST_ESSENTIAL_RECORDS.text(review).split('\n');
    expect(text[0]).toBe('EX: 39 essential records. Would someone who knows this domain but not software recognize and care about each?');
    expect(text).toContain('  Lending (EX-LEND)');
    expect(text).toContain('    EX-LEND-UC01 Use case "Borrow a tool": A member takes a free tool home.');
    expect(text).toContain('  In no domain');
    expect(() => runQuery(data, LIST_ESSENTIAL_RECORDS, { product_id: 'NOPE' })).toThrow(StoreError);
  });
});

describe('LA-CHK-UC09-R02-T01 The check-and-fix skill has the Agent hold each essential record to the domain-expert test before proposing a change', () => {
  it('runs the list, asks the question of each record, lists what fails for the Owner and changes nothing on that alone', () => {
    const skill = readFileSync(path.join(import.meta.dirname, '../../../../plugin/skills/check-and-fix/SKILL.md'), 'utf8');
    const section = skill.slice(skill.indexOf('## Review the essential records with fresh eyes'), skill.indexOf('## Gaps and coverage'));
    expect(section).toContain("the Essential review's list-essential-records query");
    expect(section).toContain('would they recognize this record and care about it?');
    expect(section).toContain('List every record that fails, with why');
    expect(section).toContain('Do not change an essential record on that finding alone');
  });
});

describe('LA-CHK-UC09-FL-T Review the essential records with fresh eyes', () => {
  it('lists the essential records alone, by domain, and has the skill hold each to the domain-expert question', async () => {
    const review = runQuery(await view(), LIST_ESSENTIAL_RECORDS, { product_id: 'EX' }) as EssentialReview;
    expect(review.domains.map((d) => d.title)).toEqual(['Lending', 'In no domain']);
    const skill = readFileSync(path.join(import.meta.dirname, '../../../../plugin/skills/check-and-fix/SKILL.md'), 'utf8');
    expect(skill).toContain('would they recognize this record and care about it?');
    expect(skill).toContain('Do not change an essential record on that finding alone');
  });
});
