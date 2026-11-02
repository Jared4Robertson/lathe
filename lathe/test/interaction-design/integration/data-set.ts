// LA-IXD-TD62 Mail integration: the domain model base, then the Mail integration with its adapter and a test written
// with the Integration aggregate's own Add commands.
import { ADD_ADAPTER } from '../../../src/interaction-design/integration/commands/add-adapter.ts';
import { ADD_INTEGRATION } from '../../../src/interaction-design/integration/commands/add-integration.ts';
import { ADD_INTEGRATION_TEST } from '../../../src/interaction-design/integration/commands/add-integration-test.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../../domain-modeling/domain-model-base.ts';

/**
 * A store with TL-INT01 Mail (its adapter TL-INT01-AD meeting TL-STD-CODE-R01 and using nodemailer, and test T01
 * starting from TL-LEND-TD01) and TL-INT02 Payments with nothing under it, on the base with any extra rows given.
 */
export async function integrationDataSet(extra: Data = {}): Promise<Store> {
  const store = await storeOn(domainModelBase(extra));
  const run = (definition: Parameters<typeof runCommand>[1], input: unknown) => runCommand(store, definition, input);
  await run(ADD_INTEGRATION, { id: 'TL-INT01', title: 'Mail', system: "The library's mail service", description: 'Sends members their due-date reminders.' });
  await run(ADD_INTEGRATION, { id: 'TL-INT02', title: 'Payments', description: 'Takes late fees.' });
  await run(ADD_ADAPTER, { id: 'TL-INT01-AD', title: 'mailer', integration_id: 'TL-INT01', file: 'src/mailer.ts', description: 'Sends one mail through the service.', meets: ['TL-STD-CODE-R01'], packages: ['nodemailer'] });
  await run(ADD_INTEGRATION_TEST, {
    id: 'TL-INT01-T01', title: 'A reminder reaches the mail service', integration_id: 'TL-INT01', level: 'integration', state: 'manual', manual_reason: 'It needs the real mail service.',
    when: 'Sends a reminder for a loan due tomorrow.', then: 'The service accepts the mail.', starts_from: ['TL-LEND-TD01'],
  });
  return store;
}
