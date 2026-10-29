// LA-AUT-TD31 An aggregate with its entities and invariants: the domain model base, then the Loan and Tool aggregates
// of TL-LEND written with the Aggregate aggregate's own Add commands.
import { ADD_AGGREGATE } from '../../../src/authoring/aggregate/commands/add-aggregate.ts';
import { ADD_DATA_MODEL } from '../../../src/authoring/aggregate/commands/add-data-model.ts';
import { ADD_ENTITY } from '../../../src/authoring/aggregate/commands/add-entity.ts';
import { ADD_INVARIANT } from '../../../src/authoring/aggregate/commands/add-invariant.ts';
import { ADD_INVARIANT_TEST } from '../../../src/authoring/aggregate/commands/add-invariant-test.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../domain-model-base.ts';

/**
 * A store with TL-LEND-A1 Loan (root EN01 with three fields, holding child EN02 Return, stored in its table, by
 * has_one; EN01's data model meeting TL-STD-CODE-R01; invariant INV01 with its test) and TL-LEND-A2 Tool (root EN03,
 * with no invariant), on the base with any extra rows given.
 */
export async function aggregateDataSet(extra: Data = {}): Promise<Store> {
  const store = await storeOn(domainModelBase(extra));
  const run = (definition: Parameters<typeof runCommand>[1], input: unknown) => runCommand(store, definition, input);
  await run(ADD_AGGREGATE, { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' });
  await run(ADD_AGGREGATE, { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' });
  await run(ADD_ENTITY, {
    id: 'TL-LEND-EN02', title: 'Return', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true, description: 'The tool coming back.',
    fields: [{ name: 'Returned at', meaning: 'When it came back.', type: 'date and time', required: false, column_name: 'returned_at' }],
  });
  await run(ADD_ENTITY, {
    id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.',
    fields: [
      { name: 'Loan ID', meaning: 'Which loan.', type: 'text', required: true, column_name: 'id' },
      { name: 'Tool', meaning: 'The tool lent.', type_aggregate_id: 'TL-LEND-A2', required: true, column_name: 'tool_id' },
      { name: 'Due', meaning: 'When it is due back.', type: 'date', required: true },
    ],
    has_one: ['TL-LEND-EN02'],
  });
  await run(ADD_ENTITY, { id: 'TL-LEND-EN03', title: 'Tool', aggregate_id: 'TL-LEND-A2', role: 'root', description: 'The tool itself.', fields: [{ name: 'Tool ID', meaning: 'Which tool.', type: 'text', required: true }] });
  await run(ADD_DATA_MODEL, { id: 'TL-LEND-EN01-DM', title: 'Loan', entity_id: 'TL-LEND-EN01', file: 'src/lending/loan.ts', meets: ['TL-STD-CODE-R01'] });
  await run(ADD_INVARIANT, { id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two active loans.' });
  await run(ADD_INVARIANT_TEST, {
    id: 'TL-LEND-INV01-T', title: 'A second loan is refused', invariant_id: 'TL-LEND-INV01', level: 'unit', state: 'automated', file: 'test/loans.test.ts',
    when: 'With a tool on loan, lends it again.', then: 'It is refused.', starts_from: ['TL-LEND-TD01'],
  });
  return store;
}
