// The record-keeping use cases of Domain modeling: the Owner or an Agent keeps a record of the domain model through
// its aggregate's command, and the store refuses a record that breaks a rule with every reason, changing nothing.
// Each row is one use case's requirement test and flow test: on a product that holds a record of nearly every kind (the
// store fixture), after the records it needs, the `lathe` command runs as a person or an Agent runs it, then the store
// is asked again with a record that breaks a rule.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore } from '../../../src/index.ts';
import { refusedBy, run } from '../../helpers.ts';
import { flags, LATHE_DIR, node } from '../product.ts';
import { everyKind, removeData, writeData } from '../../store/fixture.ts';

afterAll(removeData);

type Input = Record<string, unknown>;
type Step = [command: string, input: Input];

/** Every data file of the product, by name, as text. */
const files = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));

describe('Record keeping in Domain modeling', () => {
  it.each<[string, string, Input, Step[]?]>([
    ['LA-MOD-UC101-R01-T01 LA-MOD-UC101-FL-T', 'domain remove-domain', { id: 'TL-CAT' }, [['domain add-domain', { id: 'TL-CAT', title: 'Cataloging', product_id: 'TL', position: 2, subdomain_type: 'supporting', description: 'Which tools the library holds.' }]]],
    ['LA-MOD-UC103-R01-T01 LA-MOD-UC103-FL-T', 'domain add-term', { id: 'TL-LEND-TM03', title: 'Late fee', domain_id: 'TL-LEND', meaning: 'What a member owes for a late return.' }],
    ['LA-MOD-UC104-R01-T01 LA-MOD-UC104-FL-T', 'domain change-term', { id: 'TL-LEND-TM01', meaning: 'One tool lent to one member, kept as a loan.' }],
    ['LA-MOD-UC105-R01-T01 LA-MOD-UC105-FL-T', 'domain remove-term', { id: 'TL-LEND-TM02' }],
    ['LA-MOD-UC106-R01-T01 LA-MOD-UC106-FL-T', 'domain add-domain-service', { id: 'TL-LEND-DS02', title: 'Due date', domain_id: 'TL-LEND', statement: 'The due date MUST be fourteen days after the loan starts.' }],
    ['LA-MOD-UC107-R01-T01 LA-MOD-UC107-FL-T', 'domain change-domain-service', { id: 'TL-LEND-DS01', statement: 'The fee MUST be a day rate times the days late, at most the tool price.' }],
    ['LA-MOD-UC108-R01-T01 LA-MOD-UC108-FL-T', 'domain remove-domain-service', { id: 'TL-LEND-DS02' }, [['domain add-domain-service', { id: 'TL-LEND-DS02', title: 'Due date', domain_id: 'TL-LEND', statement: 'The due date MUST be fourteen days after the loan starts.' }]]],
    ['LA-MOD-UC109-R01-T01 LA-MOD-UC109-FL-T', 'domain change-repository', { id: 'TL-LEND-REPO01', description: 'Keeps loans in the loans table, one row each.' }],
    ['LA-MOD-UC110-R01-T01 LA-MOD-UC110-FL-T', 'domain remove-repository', { id: 'TL-LEND-REPO01' }],
    ['LA-MOD-UC111-R01-T01 LA-MOD-UC111-FL-T', 'domain add-service', { id: 'TL-LEND-DS02-SV', title: 'dueDate', domain_service_id: 'TL-LEND-DS02' }, [['domain add-domain-service', { id: 'TL-LEND-DS02', title: 'Due date', domain_id: 'TL-LEND', statement: 'The due date MUST be fourteen days after the loan starts.' }]]],
    ['LA-MOD-UC112-R01-T01 LA-MOD-UC112-FL-T', 'domain change-service', { id: 'TL-LEND-DS01-SV', title: 'lateFeeFor' }],
    ['LA-MOD-UC113-R01-T01 LA-MOD-UC113-FL-T', 'domain remove-service', { id: 'TL-LEND-DS01-SV' }],
    ['LA-MOD-UC114-R01-T01 LA-MOD-UC114-FL-T', 'domain add-domain-service-test', { id: 'TL-LEND-DS01-T02', title: 'No fee on time', domain_service_id: 'TL-LEND-DS01', level: 'unit', state: 'manual', manual_reason: 'Not yet coded.', when: 'Works out the fee for a return on time', then: 'Expects no fee' }],
    ['LA-MOD-UC115-R01-T01 LA-MOD-UC115-FL-T', 'domain change-domain-service-test', { id: 'TL-LEND-DS01-T01', then: 'Expects three day rates, no more' }],
    ['LA-MOD-UC116-R01-T01 LA-MOD-UC116-FL-T', 'domain remove-domain-service-test', { id: 'TL-LEND-DS01-T02' }, [['domain add-domain-service-test', { id: 'TL-LEND-DS01-T02', title: 'No fee on time', domain_service_id: 'TL-LEND-DS01', level: 'unit', state: 'manual', manual_reason: 'Not yet coded.', when: 'Works out the fee for a return on time', then: 'Expects no fee' }]]],
    ['LA-MOD-UC117-R01-T01 LA-MOD-UC117-FL-T', 'aggregate change-aggregate', { id: 'TL-LEND-A1', description: 'One tool lent to one member, with its return and fees.' }],
    ['LA-MOD-UC118-R01-T01 LA-MOD-UC118-FL-T', 'aggregate remove-aggregate', { id: 'TL-LEND-A3' }, [['aggregate add-aggregate', { id: 'TL-LEND-A3', title: 'Fee', domain_id: 'TL-LEND', description: 'What a member owes.', identity: 'Fee ID' }]]],
    ['LA-MOD-UC119-R01-T01 LA-MOD-UC119-FL-T', 'aggregate change-entity', { id: 'TL-LEND-EN02', description: 'The tool coming back to the desk.' }],
    ['LA-MOD-UC120-R01-T01 LA-MOD-UC120-FL-T', 'aggregate remove-entity', { id: 'TL-LEND-EN03' }, [['aggregate add-entity', { id: 'TL-LEND-EN03', title: 'Late fee', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true, description: 'A fee for a late return.' }]]],
    ['LA-MOD-UC121-R01-T01 LA-MOD-UC121-FL-T', 'aggregate change-invariant', { id: 'TL-LEND-INV01', statement: 'A tool MUST NOT have two active loans at once.' }],
    ['LA-MOD-UC122-R01-T01 LA-MOD-UC122-FL-T', 'aggregate remove-invariant', { id: 'TL-LEND-INV02' }, [['aggregate add-invariant', { id: 'TL-LEND-INV02', title: 'Two weeks at most', aggregate_id: 'TL-LEND-A1', statement: 'A loan MUST NOT last longer than two weeks.' }]]],
    ['LA-MOD-UC123-R01-T01 LA-MOD-UC123-FL-T', 'aggregate add-data-model', { id: 'TL-LEND-EN02-DM', title: 'Return', entity_id: 'TL-LEND-EN02', file: 'src/lending/return.ts' }],
    ['LA-MOD-UC124-R01-T01 LA-MOD-UC124-FL-T', 'aggregate change-data-model', { id: 'TL-LEND-EN01-DM', file: 'src/lending/loan_row.ts' }],
    ['LA-MOD-UC125-R01-T01 LA-MOD-UC125-FL-T', 'aggregate remove-data-model', { id: 'TL-LEND-EN02-DM' }, [['aggregate add-data-model', { id: 'TL-LEND-EN02-DM', title: 'Return', entity_id: 'TL-LEND-EN02', file: 'src/lending/return.ts' }]]],
    ['LA-MOD-UC126-R01-T01 LA-MOD-UC126-FL-T', 'aggregate add-invariant-test', { id: 'TL-LEND-INV02-T', title: 'A long loan is refused', invariant_id: 'TL-LEND-INV02', level: 'integration', state: 'manual', manual_reason: 'Not yet coded.', when: 'Opens a loan for three weeks', then: 'It is refused' }, [['aggregate add-invariant', { id: 'TL-LEND-INV02', title: 'Two weeks at most', aggregate_id: 'TL-LEND-A1', statement: 'A loan MUST NOT last longer than two weeks.' }]]],
    ['LA-MOD-UC127-R01-T01 LA-MOD-UC127-FL-T', 'aggregate change-invariant-test', { id: 'TL-LEND-INV01-T', then: 'It is refused with the loan that holds the tool' }],
    ['LA-MOD-UC128-R01-T01 LA-MOD-UC128-FL-T', 'aggregate remove-invariant-test', { id: 'TL-LEND-INV01-T' }],
    ['LA-MOD-UC129-R01-T01 LA-MOD-UC129-FL-T', 'aggregate add-rule', { id: 'TL-LEND-INV02-RL', title: 'loan-too-long', invariant_id: 'TL-LEND-INV02', file: 'src/lending/loan.ts' }, [['aggregate add-invariant', { id: 'TL-LEND-INV02', title: 'Two weeks at most', aggregate_id: 'TL-LEND-A1', statement: 'A loan MUST NOT last longer than two weeks.' }]]],
    ['LA-MOD-UC130-R01-T01 LA-MOD-UC130-FL-T', 'aggregate change-rule', { id: 'TL-LEND-INV01-RL', title: 'tool-already-on-loan' }],
    ['LA-MOD-UC131-R01-T01 LA-MOD-UC131-FL-T', 'aggregate remove-rule', { id: 'TL-LEND-INV01-RL' }],
    ['LA-MOD-UC132-R01-T01 LA-MOD-UC132-FL-T', 'domain-event remove-domain-event', { id: 'TL-LEND-EV02' }, [['domain-event add-domain-event', { id: 'TL-LEND-EV02', title: 'Loan closed', aggregate_id: 'TL-LEND-A1', published: false, description: 'A tool came back.' }]]],
    ['LA-MOD-UC133-R01-T01 LA-MOD-UC133-FL-T', 'domain-event change-event-type', { id: 'TL-LEND-EV01-ET', title: 'LoanOpenedEvent' }],
    ['LA-MOD-UC134-R01-T01 LA-MOD-UC134-FL-T', 'domain-event remove-event-type', { id: 'TL-LEND-EV01-ET' }],
    ['LA-MOD-UC135-R01-T01 LA-MOD-UC135-FL-T', 'command change-command', { id: 'TL-LEND-CMD01', description: 'Lends a free tool to a member for two weeks.' }],
    ['LA-MOD-UC136-R01-T01 LA-MOD-UC136-FL-T', 'command remove-command', { id: 'TL-LEND-CMD02' }, [['command add-command', { id: 'TL-LEND-CMD02', title: 'Close a loan', entity_id: 'TL-LEND-EN01', description: 'Takes a tool back.' }]]],
    ['LA-MOD-UC137-R01-T01 LA-MOD-UC137-FL-T', 'command change-command-handler', { id: 'TL-LEND-CMD01-H', description: 'Saves the loan and its event in one transaction, or neither.' }],
    ['LA-MOD-UC138-R01-T01 LA-MOD-UC138-FL-T', 'command remove-command-handler', { id: 'TL-LEND-CMD02-H' }, [['command add-command', { id: 'TL-LEND-CMD02', title: 'Close a loan', entity_id: 'TL-LEND-EN01', description: 'Takes a tool back.' }], ['command add-command-handler', { id: 'TL-LEND-CMD02-H', title: 'closeLoan', command_id: 'TL-LEND-CMD02', description: 'Saves the closed loan.' }]]],
    ['LA-MOD-UC139-R01-T01 LA-MOD-UC139-FL-T', 'command change-policy', { id: 'TL-LEND-PO01', title: 'Remind on every loan' }],
    ['LA-MOD-UC140-R01-T01 LA-MOD-UC140-FL-T', 'command remove-policy', { id: 'TL-LEND-PO02' }, [['command add-policy', { id: 'TL-LEND-PO02', title: 'Thank on return', command_id: 'TL-LEND-CMD01', statement: 'Whenever a loan is closed, the library MUST thank the member.' }]]],
    ['LA-MOD-UC141-R01-T01 LA-MOD-UC141-FL-T', 'command add-event-handler', { id: 'TL-LEND-PO02-H', title: 'onLoanClosed', policy_id: 'TL-LEND-PO02', description: 'Hears the event from the outbox relay.' }, [['command add-policy', { id: 'TL-LEND-PO02', title: 'Thank on return', command_id: 'TL-LEND-CMD01', statement: 'Whenever a loan is closed, the library MUST thank the member.' }]]],
    ['LA-MOD-UC142-R01-T01 LA-MOD-UC142-FL-T', 'command change-event-handler', { id: 'TL-LEND-PO01-H', description: 'Hears the event from the outbox relay, once each.' }],
    ['LA-MOD-UC143-R01-T01 LA-MOD-UC143-FL-T', 'command remove-event-handler', { id: 'TL-LEND-PO01-H' }],
    ['LA-MOD-UC144-R01-T01 LA-MOD-UC144-FL-T', 'command add-policy-test', { id: 'TL-LEND-PO02-T', title: 'A thanks follows a return', policy_id: 'TL-LEND-PO02', level: 'integration', state: 'manual', manual_reason: 'Not yet coded.', when: 'Closes a loan', then: 'Expects a thanks' }, [['command add-policy', { id: 'TL-LEND-PO02', title: 'Thank on return', command_id: 'TL-LEND-CMD01', statement: 'Whenever a loan is closed, the library MUST thank the member.' }]]],
    ['LA-MOD-UC145-R01-T01 LA-MOD-UC145-FL-T', 'command change-policy-test', { id: 'TL-LEND-PO01-T', then: 'Expects a reminder for the borrower' }],
    ['LA-MOD-UC146-R01-T01 LA-MOD-UC146-FL-T', 'command remove-policy-test', { id: 'TL-LEND-PO01-T' }],
    ['LA-MOD-UC147-R01-T01 LA-MOD-UC147-FL-T', 'specification change-specification', { id: 'TL-LEND-SP01', statement: 'A tool is free when no active loan names it and it is not in repair.' }],
    ['LA-MOD-UC148-R01-T01 LA-MOD-UC148-FL-T', 'specification add-predicate', { id: 'TL-LEND-SP02-PR', title: 'isInGoodStanding', specification_id: 'TL-LEND-SP02' }, [['specification add-specification', { id: 'TL-LEND-SP02', title: 'Member in good standing', statement: 'A member owes nothing.' }]]],
    ['LA-MOD-UC149-R01-T01 LA-MOD-UC149-FL-T', 'specification change-predicate', { id: 'TL-LEND-SP01-PR', title: 'isToolFree' }],
    ['LA-MOD-UC150-R01-T01 LA-MOD-UC150-FL-T', 'specification remove-predicate', { id: 'TL-LEND-SP01-PR' }],
    ['LA-MOD-UC151-R01-T01 LA-MOD-UC151-FL-T', 'specification change-specification-test', { id: 'TL-LEND-SP01-T', then: 'Expects only the tools on no loan' }],
    ['LA-MOD-UC152-R01-T01 LA-MOD-UC152-FL-T', 'specification remove-specification-test', { id: 'TL-LEND-SP01-T' }],
    ['LA-MOD-UC153-R01-T01 LA-MOD-UC153-FL-T', 'value-object change-value-object', { id: 'TL-VO01', description: 'Where a member gets mail, as typed.' }],
    ['LA-MOD-UC154-R01-T01 LA-MOD-UC154-FL-T', 'value-object change-constraint', { id: 'TL-VO01-C01', statement: 'An email address MUST hold exactly one @ sign.' }],
    ['LA-MOD-UC155-R01-T01 LA-MOD-UC155-FL-T', 'value-object remove-constraint', { id: 'TL-VO02-C01' }, [['value-object add-value-object', { id: 'TL-VO02', title: 'Phone number', description: 'Where a member can be called.' }], ['value-object add-constraint', { id: 'TL-VO02-C01', title: 'Digits only', value_object_id: 'TL-VO02', statement: 'A phone number MUST hold only digits.' }]]],
    ['LA-MOD-UC156-R01-T01 LA-MOD-UC156-FL-T', 'value-object add-value-type', { id: 'TL-VO02-VT', title: 'PhoneNumber', value_object_id: 'TL-VO02' }, [['value-object add-value-object', { id: 'TL-VO02', title: 'Phone number', description: 'Where a member can be called.' }]]],
    ['LA-MOD-UC157-R01-T01 LA-MOD-UC157-FL-T', 'value-object change-value-type', { id: 'TL-VO01-VT', title: 'EmailAddressValue' }],
    ['LA-MOD-UC158-R01-T01 LA-MOD-UC158-FL-T', 'value-object remove-value-type', { id: 'TL-VO01-VT' }],
    ['LA-MOD-UC159-R01-T01 LA-MOD-UC159-FL-T', 'value-object add-constraint-test', { id: 'TL-VO02-C01-T', title: 'Digits only', constraint_id: 'TL-VO02-C01', level: 'unit', state: 'manual', manual_reason: 'Not yet coded.', accepts: '5551234', refuses: '555-1234' }, [['value-object add-value-object', { id: 'TL-VO02', title: 'Phone number', description: 'Where a member can be called.' }], ['value-object add-constraint', { id: 'TL-VO02-C01', title: 'Digits only', value_object_id: 'TL-VO02', statement: 'A phone number MUST hold only digits.' }]]],
    ['LA-MOD-UC160-R01-T01 LA-MOD-UC160-FL-T', 'value-object change-constraint-test', { id: 'TL-VO01-C01-T', accepts: 'ann@b.org' }],
    ['LA-MOD-UC161-R01-T01 LA-MOD-UC161-FL-T', 'value-object remove-constraint-test', { id: 'TL-VO01-C01-T' }],
    ['LA-MOD-UC162-R01-T01 LA-MOD-UC162-FL-T', 'read-model change-read-model', { id: 'TL-LEND-RM01', description: 'Each member with their loans, newest first.' }],
    ['LA-MOD-UC163-R01-T01 LA-MOD-UC163-FL-T', 'read-model remove-read-model', { id: 'TL-LEND-RM02' }, [['read-model add-read-model', { id: 'TL-LEND-RM02', title: 'Overdue loans', domain_id: 'TL-LEND', description: 'The loans past their due date.' }]]],
    ['LA-MOD-UC164-R01-T01 LA-MOD-UC164-FL-T', 'read-model change-query', { id: 'TL-LEND-QRY01', description: 'The tools no active loan names, by title.' }],
    ['LA-MOD-UC165-R01-T01 LA-MOD-UC165-FL-T', 'read-model remove-query', { id: 'TL-LEND-QRY02' }, [['read-model add-query', { id: 'TL-LEND-QRY02', title: 'List overdue loans', read_model_id: 'TL-LEND-RM01', description: 'The loans past their due date.' }]]],
    ['LA-MOD-UC166-R01-T01 LA-MOD-UC166-FL-T', 'read-model change-projection', { id: 'TL-LEND-RM01-PJ', description: 'A view over the loans table, by member.' }],
    ['LA-MOD-UC167-R01-T01 LA-MOD-UC167-FL-T', 'read-model remove-projection', { id: 'TL-LEND-RM01-PJ' }],
    ['LA-MOD-UC168-R01-T01 LA-MOD-UC168-FL-T', 'read-model add-query-handler', { id: 'TL-LEND-QRY02-H', title: 'listOverdueLoans', query_id: 'TL-LEND-QRY02', description: 'Selects from the view on each call.' }, [['read-model add-query', { id: 'TL-LEND-QRY02', title: 'List overdue loans', read_model_id: 'TL-LEND-RM01', description: 'The loans past their due date.' }]]],
    ['LA-MOD-UC169-R01-T01 LA-MOD-UC169-FL-T', 'read-model change-query-handler', { id: 'TL-LEND-QRY01-H', description: 'Selects from the view on each call, free tools only.' }],
    ['LA-MOD-UC170-R01-T01 LA-MOD-UC170-FL-T', 'read-model remove-query-handler', { id: 'TL-LEND-QRY01-H' }],
    ['LA-MOD-UC171-R01-T01 LA-MOD-UC171-FL-T', 'read-model change-reader', { id: 'TL-LEND-RM01-RD', description: 'Reads the loans view for the query handlers, by member.' }],
    ['LA-MOD-UC172-R01-T01 LA-MOD-UC172-FL-T', 'read-model remove-reader', { id: 'TL-LEND-RM01-RD' }],
  ])('%s keeps a record through its command and refuses a record that breaks a rule', async (_ids, command, input, setup = []) => {
    const root = writeData(everyKind());
    const first = await openStore(root);
    for (const [step, stepInput] of setup) await run(first, step, stepInput);
    await first.close();
    const id = input.id as string;
    const verb = command.split(' ')[1].split('-')[0];
    const before = files(root);
    // The command, run from the command line.
    const ran = node(path.join(LATHE_DIR, 'bin', 'lathe.ts'), [...command.split(' '), ...flags(input), '--root', root]);
    expect({ status: ran.status, stderr: ran.stderr }).toEqual({ status: 0, stderr: '' });
    expect(files(root)).not.toEqual(before);
    const store = await openStore(root);
    if (verb === 'add') expect(store.record(id)).toBeDefined();
    else if (verb === 'remove') expect(store.record(id)).toBeUndefined();
    else for (const [field, value] of Object.entries(input)) expect(store.record(id)?.row[field]).toEqual(value);
    // The refusal gives every reason, and nothing changes: an added record again takes an ID in use, a changed or
    // removed one names a record there is not.
    const kept = files(root);
    const problems = await refusedBy(store, command, verb === 'add' ? input : { ...input, id: 'TL-LEND-NOPE' });
    expect(problems.length).toBeGreaterThan(0);
    expect(files(root)).toEqual(kept);
    await store.close();
  });
});
