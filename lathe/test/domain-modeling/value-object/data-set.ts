// LA-MOD-TD51 Email address value object: the domain model base, then the value object TL-VO01 with its field, a
// constraint with its test and its value type, written with the Value object aggregate's own Add commands.
import { ADD_CONSTRAINT } from '../../../src/domain-modeling/value-object/commands/add-constraint.ts';
import { ADD_CONSTRAINT_TEST } from '../../../src/domain-modeling/value-object/commands/add-constraint-test.ts';
import { ADD_VALUE_OBJECT } from '../../../src/domain-modeling/value-object/commands/add-value-object.ts';
import { ADD_VALUE_TYPE } from '../../../src/domain-modeling/value-object/commands/add-value-type.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { domainModelBase, storeOn } from '../domain-model-base.ts';

/**
 * A store with TL-VO01 Email address (one text field, Address), its constraint TL-VO01-C01 with its test
 * TL-VO01-C01-T starting from TL-LEND-TD01, and its value type TL-VO01-VT meeting TL-STD-CODE-R01.
 */
export async function valueObjectDataSet(): Promise<Store> {
  const store = await storeOn(domainModelBase());
  await runCommand(store, ADD_VALUE_OBJECT, {
    id: 'TL-VO01', title: 'Email address', description: 'How the library reaches a member.',
    fields: [{ name: 'Address', meaning: 'The address as the member gives it.', type: 'text', required: true, example: 'ada@example.org' }],
  });
  await runCommand(store, ADD_CONSTRAINT, { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST have exactly one @.' });
  await runCommand(store, ADD_CONSTRAINT_TEST, {
    id: 'TL-VO01-C01-T', title: 'One at sign is accepted, two are refused', constraint_id: 'TL-VO01-C01', level: 'unit', state: 'automated', file: 'test/email.test.ts',
    accepts: 'ada@example.org', refuses: 'a@b@c, refused as invalid_email', starts_from: ['TL-LEND-TD01'],
  });
  await runCommand(store, ADD_VALUE_TYPE, { id: 'TL-VO01-VT', title: 'EmailAddress', value_object_id: 'TL-VO01', file: 'src/model.ts', meets: ['TL-STD-CODE-R01'] });
  return store;
}
