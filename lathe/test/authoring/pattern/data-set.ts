// LA-AUT-TD32 One librarian-action pattern, built with its own commands: product TL and its domain TL-LEND, written as
// their rows, and the pattern TL-PAT-ACT with its setting, a rule and the rule's test, each added with the Pattern
// aggregate's own Add commands.
import { ADD_PATTERN } from '../../../src/authoring/pattern/commands/add-pattern.ts';
import { ADD_PATTERN_RULE } from '../../../src/authoring/pattern/commands/add-pattern-rule.ts';
import { ADD_PATTERN_RULE_TEST } from '../../../src/authoring/pattern/commands/add-pattern-rule-test.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';

/** A store on a fresh folder holding one pattern, built with the Pattern aggregate's own commands. */
export async function librarianAction(): Promise<Store> {
  const store = await openStore(
    writeData({
      product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
      domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }],
    }),
    { latheDataDir: null },
  );
  await runCommand(store, ADD_PATTERN, { id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL', description: 'An action the librarian takes at the desk.', settings: [{ name: 'record', meaning: 'The record the action saves.' }] });
  await runCommand(store, ADD_PATTERN_RULE, { id: 'TL-PAT-ACT-R01', title: 'Saved record reads the same', pattern_id: 'TL-PAT-ACT', statement: 'A saved record MUST read back the same.' });
  await runCommand(store, ADD_PATTERN_RULE_TEST, { id: 'TL-PAT-ACT-R01-T01', title: 'A saved tool reads the same', pattern_rule_id: 'TL-PAT-ACT-R01', domain_id: 'TL-LEND', level: 'integration', state: 'automated', file: 'test/catalog.test.ts', when: 'Saves a tool.', then: 'Expects the catalog to read the same.' });
  return store;
}
