// LA-TRC-TD02 A use case that follows a pattern: product TL with domain TL-LEND, a capability with use case
// TL-LEND-UC01, and patterns TL-PAT-ACT (settings record and required_input) and TL-PAT-LOG (no settings), written as
// their rows; then TL-LEND-UC01 follows TL-PAT-ACT, giving each setting, with the Pattern following aggregate's own
// command.
import { FOLLOW_PATTERN } from '../../../src/traceability/pattern-following/commands/follow-pattern.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';

const open: Store[] = [];

/** A store where TL-LEND-UC01 follows TL-PAT-ACT, giving record a value and required_input a reason it does not apply. */
export async function patternFollowingDataSet(): Promise<Store> {
  const store = await openStore(
    writeData({
      product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
      domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }],
      capability: [{ id: 'TL-LEND-CAP01', title: 'Loans', domain_id: 'TL-LEND', position: 1, description: 'Lending a tool and taking it back.' }],
      use_case: [{ id: 'TL-LEND-UC01', title: 'Lend a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member takes a tool home.' }],
      pattern: [
        { id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL', description: 'An action the librarian takes at the desk.' },
        { id: 'TL-PAT-LOG', title: 'Logged action', product_id: 'TL', description: 'An action written to the log.' },
      ],
      pattern_setting: [
        { pattern_id: 'TL-PAT-ACT', position: 1, name: 'record', meaning: 'The record the action saves.' },
        { pattern_id: 'TL-PAT-ACT', position: 2, name: 'required_input', meaning: 'What the librarian must enter.' },
      ],
    }),
    { latheDataDir: null },
  );
  open.push(store);
  await runCommand(store, FOLLOW_PATTERN, {
    follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT',
    setting_values: [{ setting: 'record', value: 'The loan.' }, { setting: 'required_input', not_applicable: 'The member is scanned at the desk.' }],
  });
  return store;
}

/** Closes every store patternFollowingDataSet opened. */
export async function closeFollowingStores(): Promise<void> {
  for (const store of open.splice(0)) await store.close();
}
