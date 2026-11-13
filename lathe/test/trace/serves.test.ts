// The Serves reach (LA-TRC-DS06): which records each use case whose aggregate or read model serves an outcome reaches,
// and so the outcomes each record serves, worked out from the rows alone.
import { describe, expect, it } from 'vitest';
import { servesOf } from '../../src/trace/serves.ts';
import { openStore } from '../../src/platform/data/store.ts';
import { adding, complete, withJourney, without, writeData, type Data } from '../helpers.ts';

/** What the reach finds over the data: each record with its outcomes and use cases. */
async function reach(data: Data) {
  const store = await openStore(writeData(data));
  try {
    return servesOf({ schema: store.schema, rows: (t) => store.rows(t) });
  } finally {
    await store.close();
  }
}

describe('LA-TRC-DS06-T01 a record serves the outcomes of the aggregates and read models of the use cases that reach it, and nothing else', () => {
  it('reaches from each use case through its steps to the design, technical records, rules and tests behind them', async () => {
    const served = await reach(complete());
    const through = (id: string) => served.get(id)?.useCases;
    expect(served.get('EX-LEND-A1')).toEqual({ outcomes: ['EX-BO01'], useCases: ['EX-LEND-UC01'], journeys: [] });
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
    for (const id of ['EX-LEND-CMD01-H', 'EX-LEND-REPO01', 'EX-LEND-INV01-RL', 'EX-STD-CODE-R01', 'EX-LEND-INV01-T', 'EX-LEND-UC01-FL-T']) expect(through(id), id).toEqual(['EX-LEND-UC01']);
    // The rules of a pattern the use case follows.
    expect(through('EX-PAT-ACT-R01')).toEqual(['EX-LEND-UC02']);
    // The outcome, the product, the domain and the interface serve none.
    for (const id of ['EX-BO01', 'EX', 'EX-LEND', 'EX-IF01']) expect(served.has(id), id).toBe(false);
  });

  it('serves the union of every reaching use case\'s outcomes, follows a domain\'s patterns, and reaches nothing from a use case that serves none', async () => {
    let data = adding(complete(), {
      business_outcome: [{ id: 'EX-BO02', title: 'Fewer lost tools', product_id: 'EX', statement: 'Fewer tools go missing.', measure: 'Tools lost a year.', target: 'Under two a year by 2027.', measured_outside: 'The librarian counts them.' }],
      serves: [{ source_id: 'EX-LEND-A2', target_id: 'EX-BO02' }],
      follows: [{ source_id: 'EX-LEND', target_id: 'EX-PAT-ACT' }],
      setting_value: [{ follower_id: 'EX-LEND', pattern_id: 'EX-PAT-ACT', setting: 'record', value: 'Loan' }],
    });
    data = without(data, 'serves', (r) => r.source_id === 'EX-LEND-A2' && r.target_id === 'EX-BO01');
    const served = await reach(data);
    expect(served.get('EX-LEND-A2')).toEqual({ outcomes: ['EX-BO01', 'EX-BO02'], useCases: ['EX-LEND-UC01', 'EX-LEND-UC02'], journeys: [] });
    expect(served.get('EX-LEND-CMD02')).toEqual({ outcomes: ['EX-BO02'], useCases: ['EX-LEND-UC02'], journeys: [] });
    // The domain follows the pattern, so each of its use cases reaches the pattern's rules.
    expect(served.get('EX-PAT-ACT-R01')?.useCases).toEqual(['EX-LEND-UC01', 'EX-LEND-UC02']);
    // With no outcome served, nothing is reached at all.
    expect((await reach(without(complete(), 'serves', () => true))).size).toBe(0);
  });

  it('serves a journey\'s outcomes through its steps: each use case one carries out with all it reaches, and a handoff\'s policy with its command\'s chain', async () => {
    // EX-BO02 is served by the journey alone: Add a tool, then Borrow a tool, then the reminder policy as a handoff.
    const data = without(withJourney(), 'serves', (r) => (r.source_id === 'EX-LEND-A1' || r.source_id === 'EX-LEND-A2') && r.target_id === 'EX-BO02');
    const served = await reach(data);
    expect(served.get('EX-JR01')).toEqual({ outcomes: ['EX-BO02'], useCases: [], journeys: [] });
    for (const id of ['EX-JR01-S01', 'EX-JR01-S03', 'EX-JR01-T']) expect(served.get(id), id).toEqual({ outcomes: ['EX-BO02'], useCases: [], journeys: ['EX-JR01'] });
    // A use case a step carries out serves the journey's outcomes beside its aggregate's or read model's, with all it reaches.
    expect(served.get('EX-LEND-UC02')).toEqual({ outcomes: ['EX-BO01', 'EX-BO02'], useCases: ['EX-LEND-UC02'], journeys: ['EX-JR01'] });
    expect(served.get('EX-LEND-CMD02')).toEqual({ outcomes: ['EX-BO01', 'EX-BO02'], useCases: ['EX-LEND-UC02'], journeys: ['EX-JR01'] });
    expect(served.get('EX-PAT-ACT-R01')?.journeys).toEqual(['EX-JR01']);
    // The handoff's policy, its command and that command's handler and tests serve through the journey.
    for (const id of ['EX-LEND-PO01', 'EX-LEND-PO01-H', 'EX-LEND-PO01-T', 'EX-LEND-CMD03', 'EX-LEND-CMD03-H']) expect(served.get(id)?.journeys, id).toEqual(['EX-JR01']);
    // With no aggregate or read model serving any outcome, the journey alone reaches what its steps carry out.
    const alone = await reach(without(withJourney(), 'serves', (r) => r.source_id !== 'EX-JR01'));
    expect(alone.get('EX-LEND-A2')).toEqual({ outcomes: ['EX-BO02'], useCases: ['EX-LEND-UC01', 'EX-LEND-UC02'], journeys: ['EX-JR01'] });
    expect(alone.get('EX-LEND-CMD03')).toEqual({ outcomes: ['EX-BO02'], useCases: ['EX-LEND-UC01'], journeys: ['EX-JR01'] });
  });
});

describe('LA-STD-MODELING-R20-T04 a use case serves the outcomes its aggregate or read model serves', () => {
  it("serves its result query's read model's outcomes, every use case of a group serves all of the group's, and a group serves its own with or without use cases", async () => {
    const outcome = { business_outcome: [{ id: 'EX-BO02', title: 'Fewer lost tools', product_id: 'EX', statement: 'Fewer tools go missing.', measure: 'Tools lost a year.', target: 'Under two a year by 2027.', measured_outside: 'The librarian counts them.' }] };
    // The read model serves an outcome, but no use case sits with it: it serves it alone, and passes it to nothing.
    const alone = await reach(adding(complete(), { ...outcome, serves: [{ source_id: 'EX-LEND-RM01', target_id: 'EX-BO02' }] }));
    expect(alone.get('EX-LEND-RM01')).toEqual({ outcomes: ['EX-BO01', 'EX-BO02'], useCases: ['EX-LEND-UC01'], journeys: [] });
    expect(alone.get('EX-LEND-QRY01')?.outcomes).toEqual(['EX-BO01']);
    // A use case asking the read model's query sits with it, and serves its outcomes with all it reaches.
    const asked = await reach(adding(complete(), {
      ...outcome,
      serves: [{ source_id: 'EX-LEND-RM01', target_id: 'EX-BO02' }],
      use_case: [{ id: 'EX-LEND-UC03', title: 'See the free tools', domain_id: 'EX-LEND', goal: 'A member sees which tools are free.', result_id: 'EX-LEND-QRY01' }],
      flow: [{ id: 'EX-LEND-UC03-FL', title: 'See the free tools', use_case_id: 'EX-LEND-UC03' }],
      flow_step: [{ id: 'EX-LEND-UC03-FL-S01', title: 'See the free tools', flow_id: 'EX-LEND-UC03-FL', path: 'main', position: 1 }],
      invokes: [{ source_id: 'EX-LEND-UC03-FL-S01', target_id: 'EX-LEND-QRY01' }],
    }));
    expect(asked.get('EX-LEND-UC03')).toEqual({ outcomes: ['EX-BO02'], useCases: ['EX-LEND-UC03'], journeys: [] });
    expect(asked.get('EX-LEND-QRY01')).toEqual({ outcomes: ['EX-BO01', 'EX-BO02'], useCases: ['EX-LEND-UC01', 'EX-LEND-UC03'], journeys: [] });
    // Two use cases whose results are commands of one aggregate both serve each outcome it serves.
    const both = await reach(adding(complete(), {
      ...outcome,
      serves: [{ source_id: 'EX-LEND-A1', target_id: 'EX-BO02' }],
      use_case: [{ id: 'EX-LEND-UC03', title: 'Remind the borrower', domain_id: 'EX-LEND', goal: 'The librarian reminds a borrower of the due date.', result_id: 'EX-LEND-CMD03' }],
    }));
    for (const id of ['EX-LEND-UC01', 'EX-LEND-UC03']) expect(both.get(id)?.outcomes, id).toEqual(['EX-BO01', 'EX-BO02']);
  });
});

describe("LA-TRC-DS06-T02 a product's own relations carry the reach both ways", () => {
  it("reaches a product's record that links to a reached one, and what a reached record links to, through the product's relations", async () => {
    const data = adding(complete(), {
      product_kind: [{ name: 'script', product_id: 'EX', label: 'Script', description: 'A script.', parent_kind: 'domain', stage: 'technical-specification', obligation: false, complexity: 'accidental' }],
      product_kind_field: [{ kind: 'script', position: 1, name: 'file', type: 'text', required: true, description: 'The file.' }],
      product_relation: [
        { name: 'listed_in', source_kind: 'script', target_kind: 'aggregate', product_id: 'EX', forward_label: 'Listed in', reverse_label: 'Lists', description: 'The aggregate lists the script.' },
        { name: 'honors', source_kind: 'script', target_kind: 'standard_rule', product_id: 'EX', forward_label: 'Honors', reverse_label: 'Honored by', description: 'The script follows the rule.' },
      ],
      standard_rule: [{ id: 'EX-STD-CODE-R02', title: 'Typed errors', standard_id: 'EX-STD-CODE', statement: 'Code MUST throw typed errors.' }],
      script: [
        { id: 'EX-LEND-SC01', title: 'lend.sh', domain_id: 'EX-LEND', file: 'bin/lend.sh' },
        { id: 'EX-LEND-SC02', title: 'idle.sh', domain_id: 'EX-LEND', file: 'bin/idle.sh' },
      ],
      listed_in: [{ source_id: 'EX-LEND-SC01', target_id: 'EX-LEND-A1' }],
      honors: [{ source_id: 'EX-LEND-SC01', target_id: 'EX-STD-CODE-R02' }],
    });
    const served = await reach(data);
    // The aggregate is reached, so the script listed in it is, and so is the rule the script honors.
    expect(served.get('EX-LEND-SC01')?.useCases).toEqual(['EX-LEND-UC01']);
    expect(served.get('EX-STD-CODE-R02')?.useCases).toEqual(['EX-LEND-UC01']);
    // A product's record linked to nothing is reached by nothing.
    expect(served.has('EX-LEND-SC02')).toBe(false);
  });
});
