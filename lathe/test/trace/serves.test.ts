// The Serves reach (LA-TRC-DS06): which records each use case whose capability serves an outcome reaches, and so the
// outcomes each record serves, worked out from the rows alone.
import { describe, expect, it } from 'vitest';
import { servesOf } from '../../src/trace/serves.ts';
import { openStore } from '../../src/platform/data/store.ts';
import { adding, changing, complete, without, writeData, type Data } from '../helpers.ts';

/** What the reach finds over the data: each record with its outcomes and use cases. */
async function reach(data: Data) {
  const store = await openStore(writeData(data));
  try {
    return servesOf({ schema: store.schema, rows: (t) => store.rows(t) });
  } finally {
    await store.close();
  }
}

describe('LA-TRC-DS06-T01 a record serves the outcomes of the capabilities of the use cases that reach it, and nothing else', () => {
  it('reaches from each use case through its steps to the design, technical records, rules and tests behind them', async () => {
    const served = await reach(complete());
    const through = (id: string) => served.get(id)?.useCases;
    expect(served.get('EX-LEND-A1')).toEqual({ outcomes: ['EX-BO01'], useCases: ['EX-LEND-UC01'] });
    // A command's aggregate, its invariants and storage requirements, and the value objects its fields hold with their constraints.
    for (const id of ['EX-LEND-INV01', 'EX-LEND-A1-SR01', 'EX-LEND-EN02', 'EX-VO01', 'EX-VO01-C01']) expect(through(id), id).toEqual(['EX-LEND-UC01']);
    // What the command checks and calls, the event it raises, the policy that hears it and that policy's command.
    for (const id of ['EX-LEND-SP01', 'EX-LEND-DS01', 'EX-LEND-EV01', 'EX-LEND-PO01', 'EX-LEND-CMD03']) expect(through(id), id).toEqual(['EX-LEND-UC01']);
    // A query's read model and the aggregate it reads; the view a step happens in, its requirement and the component building it.
    expect(through('EX-LEND-RM01')).toEqual(['EX-LEND-UC01']);
    expect(through('EX-LEND-A2')).toEqual(['EX-LEND-UC01', 'EX-LEND-UC02']);
    for (const id of ['EX-V01', 'EX-V01-R01', 'EX-UI01']) expect(through(id), id).toEqual(['EX-LEND-UC01', 'EX-LEND-UC02']);
    // An endpoint exposing a reached command and its API requirement; an integration a step exchanges with.
    for (const id of ['EX-LEND-EP01', 'EX-LEND-EP01-R01', 'EX-INT01', 'EX-INT01-AD']) expect(through(id), id).toEqual(['EX-LEND-UC01']);
    // The technical records of what is reached, the standard rules they meet, and the tests under reached records.
    for (const id of ['EX-LEND-CMD01-H', 'EX-LEND-REPO01', 'EX-LEND-INV01-RL', 'EX-STD-CODE-R01', 'EX-LEND-INV01-T', 'EX-LEND-UC01-FL01-T']) expect(through(id), id).toEqual(['EX-LEND-UC01']);
    // The rules of a pattern the use case follows.
    expect(through('EX-PAT-ACT-R01')).toEqual(['EX-LEND-UC02']);
    // The capability serves its own outcomes; the outcome, the product, the domain and the interface serve none.
    expect(served.get('EX-LEND-CAP01')).toEqual({ outcomes: ['EX-BO01'], useCases: [] });
    for (const id of ['EX-BO01', 'EX', 'EX-LEND', 'EX-IF01']) expect(served.has(id), id).toBe(false);
  });

  it('serves the union of every reaching use case\'s outcomes, follows a domain\'s patterns, and reaches nothing from a use case that serves none', async () => {
    let data = adding(complete(), {
      business_outcome: [{ id: 'EX-BO02', title: 'Fewer lost tools', product_id: 'EX', statement: 'Fewer tools go missing.', measure: 'Tools lost a year.', target: 'Under two a year by 2027.', measured_outside: 'The librarian counts them.' }],
      capability: [{ id: 'EX-LEND-CAP02', title: 'Cataloging', domain_id: 'EX-LEND', position: 2, description: 'Keeping the catalog.' }],
      serves: [{ source_id: 'EX-LEND-CAP02', target_id: 'EX-BO02' }],
      follows: [{ source_id: 'EX-LEND', target_id: 'EX-PAT-ACT' }],
      setting_value: [{ follower_id: 'EX-LEND', pattern_id: 'EX-PAT-ACT', setting: 'record', value: 'Loan' }],
    });
    data = changing(data, 'use_case', (r) => r.id === 'EX-LEND-UC02', { capability_id: 'EX-LEND-CAP02' });
    const served = await reach(data);
    expect(served.get('EX-LEND-A2')).toEqual({ outcomes: ['EX-BO01', 'EX-BO02'], useCases: ['EX-LEND-UC01', 'EX-LEND-UC02'] });
    expect(served.get('EX-LEND-CMD02')).toEqual({ outcomes: ['EX-BO02'], useCases: ['EX-LEND-UC02'] });
    // The domain follows the pattern, so each of its use cases reaches the pattern's rules.
    expect(served.get('EX-PAT-ACT-R01')?.useCases).toEqual(['EX-LEND-UC01', 'EX-LEND-UC02']);
    // With no outcome served, nothing is reached at all.
    expect((await reach(without(complete(), 'serves', () => true))).size).toBe(0);
  });
});
