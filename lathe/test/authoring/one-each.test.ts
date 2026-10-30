// The "at most one each" invariants (LA-AUT-INV101–108, INV110–112), each its aggregate's own rule: the command that
// would add a second record is refused with the rule's name and its own message, before the schema's unique key
// underneath is reached, and nothing changes.
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_VALUE_TYPE } from '../../src/authoring/value-object/commands/add-value-type.ts';
import { ADD_CONSTRAINT_TEST } from '../../src/authoring/value-object/commands/add-constraint-test.ts';
import { ADD_DATA_MODEL } from '../../src/authoring/aggregate/commands/add-data-model.ts';
import { ADD_RULE } from '../../src/authoring/aggregate/commands/add-rule.ts';
import { ADD_INVARIANT_TEST } from '../../src/authoring/aggregate/commands/add-invariant-test.ts';
import { ADD_PREDICATE } from '../../src/authoring/specification/commands/add-predicate.ts';
import { ADD_SPECIFICATION_TEST } from '../../src/authoring/specification/commands/add-specification-test.ts';
import { ADD_PATTERN_RULE_TEST } from '../../src/authoring/pattern/commands/add-pattern-rule-test.ts';
import { ADD_TABLE } from '../../src/authoring/table/commands/add-table.ts';
import { ADD_PROJECTION } from '../../src/authoring/read-model/commands/add-projection.ts';
import { ADD_QUERY_HANDLER } from '../../src/authoring/read-model/commands/add-query-handler.ts';
import { ADD_READER } from '../../src/authoring/read-model/commands/add-reader.ts';
import { ADD_EVENT_TYPE } from '../../src/authoring/domain-event/commands/add-event-type.ts';
import { ADD_ENDPOINT_HANDLER } from '../../src/authoring/endpoint/commands/add-endpoint-handler.ts';
import { ADD_ADAPTER } from '../../src/authoring/integration/commands/add-adapter.ts';
import { ADD_SERVICE } from '../../src/authoring/domain/commands/add-service.ts';
import type { AnyCommand } from '../../src/platform/commands/definition.ts';
import { runCommand } from '../../src/platform/commands/run.ts';
import { StoreError } from '../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../src/platform/data/store.ts';
import { writeData } from '../helpers.ts';
import { everyKind } from '../store/fixture.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/** A store on the fixture, which has one record of every kind, so each parent already has its one. */
async function store(): Promise<Store> {
  const opened = await openStore(writeData(everyKind()), { latheDataDir: null });
  open.push(opened);
  return opened;
}

/** The rules and messages a command is refused with; a failure when it is not refused. */
async function refused(on: Store, definition: AnyCommand, input: unknown): Promise<{ rule: string; message: string }[]> {
  try {
    await runCommand(on, definition, input);
  } catch (error) {
    if (error instanceof StoreError) return error.problems.map((p) => ({ rule: p.rule, message: p.message }));
    throw error;
  }
  throw new Error(`${definition.id} was not refused`);
}

const test = { level: 'unit', state: 'automated', file: 'test/second.test.ts', when: 'Does it again', then: 'Expects the same' };

describe('LA-AUT-INV101-T a second value type of a value object, or a second test of a constraint, is refused', () => {
  it('refuses each with value-object-one-each', async () => {
    const on = await store();
    expect(await refused(on, ADD_VALUE_TYPE, { id: 'TL-VO01-VT2', title: 'Email', value_object_id: 'TL-VO01' })).toEqual([
      { rule: 'value-object-one-each', message: 'value object TL-VO01 already has its value type, so TL-VO01-VT2 cannot be a second: a value object has one' },
    ]);
    expect(await refused(on, ADD_CONSTRAINT_TEST, { id: 'TL-VO01-C01-T2', title: 'Two at signs', constraint_id: 'TL-VO01-C01', level: 'unit', state: 'automated', file: 'test/email.test.ts', accepts: 'a@b.org', refuses: 'a@@b' })).toEqual([
      { rule: 'value-object-one-each', message: 'constraint TL-VO01-C01 already has its test, so TL-VO01-C01-T2 cannot be a second: a constraint has one' },
    ]);
  });
});

describe('LA-AUT-INV102-T a second data model of an entity, or a second rule or test of an invariant, is refused', () => {
  it('refuses each with aggregate-one-each', async () => {
    const on = await store();
    expect(await refused(on, ADD_DATA_MODEL, { id: 'TL-LEND-EN01-DM2', title: 'LoanRow', entity_id: 'TL-LEND-EN01' })).toEqual([
      { rule: 'aggregate-one-each', message: 'entity TL-LEND-EN01 already has its data model, so TL-LEND-EN01-DM2 cannot be a second: an entity has one' },
    ]);
    expect(await refused(on, ADD_RULE, { id: 'TL-LEND-INV01-RL2', title: 'one-loan', invariant_id: 'TL-LEND-INV01' })).toEqual([
      { rule: 'aggregate-one-each', message: 'invariant TL-LEND-INV01 already has its rule, so TL-LEND-INV01-RL2 cannot be a second: an invariant has one' },
    ]);
    expect(await refused(on, ADD_INVARIANT_TEST, { id: 'TL-LEND-INV01-T2', title: 'Again', invariant_id: 'TL-LEND-INV01', ...test, level: 'integration' })).toEqual([
      { rule: 'aggregate-one-each', message: 'invariant TL-LEND-INV01 already has its test, so TL-LEND-INV01-T2 cannot be a second: an invariant has one' },
    ]);
  });
});

describe('LA-AUT-INV103-T a second predicate or test of a specification is refused', () => {
  it('refuses each with specification-one-each', async () => {
    const on = await store();
    expect(await refused(on, ADD_PREDICATE, { id: 'TL-LEND-SP01-PR2', title: 'isAvailable', specification_id: 'TL-LEND-SP01' })).toEqual([
      { rule: 'specification-one-each', message: 'specification TL-LEND-SP01 already has its predicate, so TL-LEND-SP01-PR2 cannot be a second: a specification has one' },
    ]);
    expect(await refused(on, ADD_SPECIFICATION_TEST, { id: 'TL-LEND-SP01-T2', title: 'Again', specification_id: 'TL-LEND-SP01', ...test })).toEqual([
      { rule: 'specification-one-each', message: 'specification TL-LEND-SP01 already has its test, so TL-LEND-SP01-T2 cannot be a second: a specification has one' },
    ]);
  });
});

describe('LA-AUT-INV105-T a second test of a pattern rule for one domain is refused', () => {
  it('refuses it with pattern-rule-test-per-domain', async () => {
    const on = await store();
    expect(await refused(on, ADD_PATTERN_RULE_TEST, { id: 'TL-PAT-ACT-R01-T02', title: 'Again', pattern_rule_id: 'TL-PAT-ACT-R01', domain_id: 'TL-LEND', ...test })).toEqual([
      { rule: 'pattern-rule-test-per-domain', message: 'pattern rule TL-PAT-ACT-R01 already has its test for domain TL-LEND, so TL-PAT-ACT-R01-T02 cannot be a second: a rule has one test per domain' },
    ]);
  });
});

describe('LA-AUT-INV106-T a second table of an entity or a read model is refused', () => {
  it('refuses each with one-table-each', async () => {
    const on = await store();
    expect(await refused(on, ADD_TABLE, { id: 'TL-LEND-EN01-TB2', title: 'loans_again', entity_id: 'TL-LEND-EN01', name: 'loans_again', storage: 'table' })).toEqual([
      { rule: 'one-table-each', message: 'entity TL-LEND-EN01 already has its table, TL-LEND-EN01-TB, so TL-LEND-EN01-TB2 cannot be a second: an entity has one' },
    ]);
    expect(await refused(on, ADD_TABLE, { id: 'TL-LEND-RM01-TB2', title: 'by_member', read_model_id: 'TL-LEND-RM01', name: 'by_member', storage: 'view' })).toEqual([
      { rule: 'one-table-each', message: 'read model TL-LEND-RM01 already has its table, TL-LEND-RM01-TB, so TL-LEND-RM01-TB2 cannot be a second: a read model has one' },
    ]);
  });
});

describe('LA-AUT-INV107-T a second projection or reader of a read model, or a second handler of a query, is refused', () => {
  it('refuses each with read-model-one-each', async () => {
    const on = await store();
    expect(await refused(on, ADD_PROJECTION, { id: 'TL-LEND-RM01-PJ2', title: 'byMember', read_model_id: 'TL-LEND-RM01', description: 'Another view.' })).toEqual([
      { rule: 'read-model-one-each', message: 'read model TL-LEND-RM01 already has its projection, so TL-LEND-RM01-PJ2 cannot be a second: a read model has one' },
    ]);
    expect(await refused(on, ADD_READER, { id: 'TL-LEND-RM01-RD2', title: 'LoanReaderAgain', read_model_id: 'TL-LEND-RM01', description: 'Another reader.' })).toEqual([
      { rule: 'read-model-one-each', message: 'read model TL-LEND-RM01 already has its reader, so TL-LEND-RM01-RD2 cannot be a second: a read model has one' },
    ]);
    expect(await refused(on, ADD_QUERY_HANDLER, { id: 'TL-LEND-QRY01-H2', title: 'listTools', query_id: 'TL-LEND-QRY01', description: 'Selects again.' })).toEqual([
      { rule: 'read-model-one-each', message: 'query TL-LEND-QRY01 already has its query handler, so TL-LEND-QRY01-H2 cannot be a second: a query has one' },
    ]);
  });
});

describe('LA-AUT-INV108-T a second event type of a domain event is refused', () => {
  it('refuses it with one-event-type', async () => {
    const on = await store();
    expect(await refused(on, ADD_EVENT_TYPE, { id: 'TL-LEND-EV01-ET2', title: 'LoanStarted', domain_event_id: 'TL-LEND-EV01', delivery: 'outbox' })).toEqual([
      { rule: 'one-event-type', message: 'domain event TL-LEND-EV01 already has its event type, so TL-LEND-EV01-ET2 cannot be a second: an event has one' },
    ]);
  });
});

describe('LA-AUT-INV110-T a second handler of an endpoint is refused', () => {
  it('refuses it with one-endpoint-handler', async () => {
    const on = await store();
    expect(await refused(on, ADD_ENDPOINT_HANDLER, { id: 'TL-LEND-EP01-H2', title: 'postLoanAgain', endpoint_id: 'TL-LEND-EP01', description: 'Reads the body again.' })).toEqual([
      { rule: 'one-endpoint-handler', message: 'endpoint TL-LEND-EP01 already has its endpoint handler, so TL-LEND-EP01-H2 cannot be a second: an endpoint has one' },
    ]);
  });
});

describe('LA-AUT-INV111-T a second adapter of an integration is refused', () => {
  it('refuses it with one-adapter', async () => {
    const on = await store();
    expect(await refused(on, ADD_ADAPTER, { id: 'TL-INT01-AD2', title: 'mailer2', integration_id: 'TL-INT01', description: 'Sends mail again.' })).toEqual([
      { rule: 'one-adapter', message: 'integration TL-INT01 already has its adapter, so TL-INT01-AD2 cannot be a second: an integration has one' },
    ]);
  });
});

describe('LA-AUT-INV112-T a second service of a domain service is refused', () => {
  it('refuses it with one-service', async () => {
    const on = await store();
    expect(await refused(on, ADD_SERVICE, { id: 'TL-LEND-DS01-SV2', title: 'fee', domain_service_id: 'TL-LEND-DS01' })).toEqual([
      { rule: 'one-service', message: 'domain service TL-LEND-DS01 already has its service, so TL-LEND-DS01-SV2 cannot be a second: a domain service has one' },
    ]);
  });
});
