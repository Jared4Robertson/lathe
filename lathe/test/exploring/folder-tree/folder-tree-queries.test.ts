// The Folder tree read (LA-EXP-RM02, LA-EXP-QRY05): a product's nav tree, Shared then each domain, each with its stages,
// one folder per kind, the records that start a branch there and what folds under each, read through the read model's
// reader, as the nav, Quick open and the graph's tree read it.
import { afterEach, describe, expect, it } from 'vitest';
import { GET_FOLDER_TREE } from '../../../src/exploring/folder-tree/queries.ts';
import type { FolderTree, OwnerFolders } from '../../../src/exploring/folder-tree/read-model.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData, type Data } from '../../helpers.ts';
import { TWO_PRODUCTS } from '../../checking/problems/data-set.ts';

const open: Store[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

/** The two products, with three terms of EX-LEND, one building on another, and a capability. */
const DATA: Data = {
  ...TWO_PRODUCTS,
  term: [
    { id: 'EX-LEND-TM01', title: 'Overdue', domain_id: 'EX-LEND', meaning: 'A loan past its due date.' },
    { id: 'EX-LEND-TM02', title: 'Borrow', domain_id: 'EX-LEND', meaning: 'Take a tool on loan.' },
    { id: 'EX-LEND-TM03', title: 'Lend', domain_id: 'EX-LEND', meaning: 'Give a tool on loan.' },
  ],
  builds_on: [{ source_id: 'EX-LEND-TM01', target_id: 'EX-LEND-TM03' }],
};

async function tree(): Promise<FolderTree> {
  const store = await openStore(writeData(DATA));
  open.push(store);
  return runQuery({ schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id) }, GET_FOLDER_TREE, { product_id: 'EX' }) as FolderTree;
}

const stage = (owner: OwnerFolders, name: string) => owner.stages.find((s) => s.stage === name)!;

describe('LA-EXP-UC08-R06-T02 The folder tree read gives Shared and each domain its stages, a folder per kind and what folds under each record', () => {
  it('lists Shared and the product\'s domains, nothing of another product', async () => {
    const t = await tree();
    expect(t.product).toBe('EX');
    expect(t.shared.owner).toBe('EX');
    expect(t.domains.map((d) => `${d.owner} ${d.title}`)).toEqual(['EX-LEND Lending']);
  });

  it('folds an aggregate\'s entities and invariants under it, and keeps empty folders only where a kind can start a branch', async () => {
    const domainModel = stage((await tree()).domains[0], 'domain-model');
    const aggregates = domainModel.folders.find((f) => f.kind === 'aggregate')!;
    expect(aggregates.key).toBe('EX-LEND/domain-model/aggregate');
    expect(aggregates.entries.map((e) => e.id)).toEqual(['EX-LEND-A1']);
    expect(aggregates.entries[0].folded.map((e) => e.id)).toEqual(['EX-LEND-EN01', 'EX-LEND-INV01']);
    expect(domainModel.folders.map((f) => f.kind)).not.toContain('entity');
    expect(domainModel.folders.find((f) => f.kind === 'specification')!.entries.map((e) => e.id)).toEqual(['EX-LEND-SP01']);
  });

  it('lists terms bottom-up, each after the terms it builds on', async () => {
    const terms = stage((await tree()).domains[0], 'domain-model').folders.find((f) => f.kind === 'term')!;
    expect(terms.entries.map((e) => e.title)).toEqual(['Borrow', 'Lend', 'Overdue']);
  });

  it('shows a stage\'s one folder directly, and puts what the product shares under Shared', async () => {
    const t = await tree();
    for (const s of [...t.shared.stages, ...t.domains[0].stages]) expect(s.direct).toBe(s.folders.length === 1);
    expect(stage(t.shared, 'use-cases').folders.find((f) => f.kind === 'pattern')!.entries.map((e) => e.id)).toEqual(['EX-PAT-ACT']);
    expect(stage(t.shared, 'use-cases').folders.find((f) => f.kind === 'pattern')!.entries[0].folded.map((e) => e.id)).toEqual(['EX-PAT-ACT-R01']);
  });
});
