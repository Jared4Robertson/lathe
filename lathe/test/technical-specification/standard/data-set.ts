// LA-TEC-TD33 One code standard, built with its own commands: product TL, written as its row, and the standard
// TL-STD-CODE with a rule and the rule's test, each added with the Standard aggregate's own Add commands.
import { ADD_STANDARD } from '../../../src/technical-specification/standard/commands/add-standard.ts';
import { ADD_STANDARD_RULE } from '../../../src/technical-specification/standard/commands/add-standard-rule.ts';
import { ADD_STANDARD_RULE_TEST } from '../../../src/technical-specification/standard/commands/add-standard-rule-test.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';

/** A store on a fresh folder holding one standard, built with the Standard aggregate's own commands. */
export async function codeStandard(): Promise<Store> {
  const store = await openStore(writeData({ product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }] }), { latheDataDir: null });
  await runCommand(store, ADD_STANDARD, { id: 'TL-STD-CODE', title: 'Code', product_id: 'TL', type: 'engineering', description: 'How the code is written.' });
  await runCommand(store, ADD_STANDARD_RULE, { id: 'TL-STD-CODE-R01', title: 'Node prefix', standard_id: 'TL-STD-CODE', statement: 'Code MUST import node: modules.' });
  await runCommand(store, ADD_STANDARD_RULE_TEST, { id: 'TL-STD-CODE-R01-T01', title: 'No bare built-in import', standard_rule_id: 'TL-STD-CODE-R01', level: 'unit', state: 'automated', file: 'test/imports.test.ts', when: 'Scans the imports.', then: 'Expects every built-in imported with node:.' });
  return store;
}
