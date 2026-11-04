// LA-PAT-AGGREGATE-COMMANDS-R13-T01 LA-PAT-AGGREGATE-COMMANDS-R13-T04 LA-PAT-AGGREGATE-COMMANDS-R13-T05 LA-PAT-AGGREGATE-COMMANDS-R13-T06 LA-PAT-AGGREGATE-COMMANDS-R13-T07 LA-PAT-AGGREGATE-COMMANDS-R13-T08: in the stage domains, a Remove takes its record whole, with everything under it inside its
// aggregate, their parts and the links they start, and is refused, naming what references them, while anything left
// still does: at the store, then in each of the stage domains' aggregates whose removal holds more than one record.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { ADD_INVARIANT } from '../src/domain-modeling/aggregate/commands/add-invariant.ts';
import { REMOVE_AGGREGATE } from '../src/domain-modeling/aggregate/commands/remove-aggregate.ts';
import { REMOVE_DATA_MODEL } from '../src/domain-modeling/aggregate/commands/remove-data-model.ts';
import { REMOVE_ENTITY } from '../src/domain-modeling/aggregate/commands/remove-entity.ts';
import { REMOVE_INVARIANT_TEST } from '../src/domain-modeling/aggregate/commands/remove-invariant-test.ts';
import { REMOVE_INVARIANT } from '../src/domain-modeling/aggregate/commands/remove-invariant.ts';
import { ADD_EVENT_HANDLER } from '../src/domain-modeling/command/commands/add-event-handler.ts';
import { CHANGE_COMMAND } from '../src/domain-modeling/command/commands/change-command.ts';
import { REMOVE_COMMAND_HANDLER } from '../src/domain-modeling/command/commands/remove-command-handler.ts';
import { REMOVE_COMMAND } from '../src/domain-modeling/command/commands/remove-command.ts';
import { REMOVE_EVENT_HANDLER } from '../src/domain-modeling/command/commands/remove-event-handler.ts';
import { REMOVE_POLICY_TEST } from '../src/domain-modeling/command/commands/remove-policy-test.ts';
import { REMOVE_POLICY } from '../src/domain-modeling/command/commands/remove-policy.ts';
import { REMOVE_DATA_STORE } from '../src/technical-specification/data-store/commands/remove-data-store.ts';
import { ADD_EVENT_TYPE } from '../src/domain-modeling/domain-event/commands/add-event-type.ts';
import { REMOVE_DOMAIN_EVENT } from '../src/domain-modeling/domain-event/commands/remove-domain-event.ts';
import { REMOVE_EVENT_TYPE } from '../src/domain-modeling/domain-event/commands/remove-event-type.ts';
import { CHANGE_REPOSITORY } from '../src/domain-modeling/domain/commands/change-repository.ts';
import { REMOVE_API_REQUIREMENT } from '../src/interface-design/endpoint/commands/remove-api-requirement.ts';
import { REMOVE_ENDPOINT_HANDLER } from '../src/interface-design/endpoint/commands/remove-endpoint-handler.ts';
import { REMOVE_ENDPOINT_TEST } from '../src/interface-design/endpoint/commands/remove-endpoint-test.ts';
import { REMOVE_ENDPOINT } from '../src/interface-design/endpoint/commands/remove-endpoint.ts';
import { REMOVE_ADAPTER } from '../src/interface-design/integration/commands/remove-adapter.ts';
import { REMOVE_INTEGRATION_TEST } from '../src/interface-design/integration/commands/remove-integration-test.ts';
import { REMOVE_INTEGRATION } from '../src/interface-design/integration/commands/remove-integration.ts';
import { ADD_QUESTION } from '../src/product/product/commands/add-question.ts';
import { CHANGE_QUESTION } from '../src/product/product/commands/change-question.ts';
import { ADD_QUERY_HANDLER } from '../src/domain-modeling/read-model/commands/add-query-handler.ts';
import { REMOVE_PROJECTION } from '../src/domain-modeling/read-model/commands/remove-projection.ts';
import { REMOVE_QUERY_HANDLER } from '../src/domain-modeling/read-model/commands/remove-query-handler.ts';
import { REMOVE_QUERY } from '../src/domain-modeling/read-model/commands/remove-query.ts';
import { REMOVE_READ_MODEL } from '../src/domain-modeling/read-model/commands/remove-read-model.ts';
import { REMOVE_READER } from '../src/domain-modeling/read-model/commands/remove-reader.ts';
import { ADD_PREDICATE } from '../src/domain-modeling/specification/commands/add-predicate.ts';
import { REMOVE_PREDICATE } from '../src/domain-modeling/specification/commands/remove-predicate.ts';
import { REMOVE_SPECIFICATION_TEST } from '../src/domain-modeling/specification/commands/remove-specification-test.ts';
import { REMOVE_SPECIFICATION } from '../src/domain-modeling/specification/commands/remove-specification.ts';
import { REMOVE_STORAGE_REQUIREMENT_TEST } from '../src/domain-modeling/storage-requirement/commands/remove-storage-requirement-test.ts';
import { REMOVE_STORAGE_REQUIREMENT } from '../src/domain-modeling/storage-requirement/commands/remove-storage-requirement.ts';
import { CHANGE_TABLE } from '../src/technical-specification/table/commands/change-table.ts';
import { REMOVE_TABLE } from '../src/technical-specification/table/commands/remove-table.ts';
import { REMOVE_UI_COMPONENT } from '../src/interface-design/ui-component/commands/remove-ui-component.ts';
import { ADD_CONSTRAINT_TEST } from '../src/domain-modeling/value-object/commands/add-constraint-test.ts';
import { REMOVE_CONSTRAINT_TEST } from '../src/domain-modeling/value-object/commands/remove-constraint-test.ts';
import { REMOVE_CONSTRAINT } from '../src/domain-modeling/value-object/commands/remove-constraint.ts';
import { REMOVE_VALUE_OBJECT } from '../src/domain-modeling/value-object/commands/remove-value-object.ts';
import { REMOVE_VALUE_TYPE } from '../src/domain-modeling/value-object/commands/remove-value-type.ts';
import { ADD_VIEW_REQUIREMENT } from '../src/interface-design/view/commands/add-view-requirement.ts';
import { CHANGE_VIEW_REQUIREMENT } from '../src/interface-design/view/commands/change-view-requirement.ts';
import { REMOVE_VIEW_REQUIREMENT } from '../src/interface-design/view/commands/remove-view-requirement.ts';
import { REMOVE_VIEW_TEST } from '../src/interface-design/view/commands/remove-view-test.ts';
import { REMOVE_VIEW } from '../src/interface-design/view/commands/remove-view.ts';
import type { AnyCommand } from '../src/platform/commands/definition.ts';
import { runCommand } from '../src/platform/commands/run.ts';
import { StoreError } from '../src/platform/data/problems.ts';
import { openStore, type Store } from '../src/platform/data/store.ts';
import { REMOVE_PROVIDER } from '../src/traceability/provision/commands/remove-provider.ts';
import { refusedBy, run } from './helpers.ts';
import { everyKind, removeData, writeData } from './store/fixture.ts';
import { aggregateDataSet } from './domain-modeling/aggregate/data-set.ts';
import { commandDataSet } from './domain-modeling/command/data-set.ts';
import { dataStoreDataSet } from './technical-specification/data-store/data-set.ts';
import { domainEventDataSet } from './domain-modeling/domain-event/data-set.ts';
import { closeOpenStores, domainModelBase, storeOn } from './domain-modeling/domain-model-base.ts';
import { endpointDataSet } from './interface-design/endpoint/data-set.ts';
import { integrationDataSet } from './interface-design/integration/data-set.ts';
import { AROUND as READ_MODEL_AROUND, readModelDataSet } from './domain-modeling/read-model/data-set.ts';
import { AROUND as SPECIFICATION_AROUND, specificationDataSet } from './domain-modeling/specification/data-set.ts';
import { storageRequirementDataSet } from './domain-modeling/storage-requirement/data-set.ts';
import { tableDataSet } from './technical-specification/table/data-set.ts';
import { uiComponentDataSet } from './interface-design/ui-component/data-set.ts';
import { valueObjectDataSet } from './domain-modeling/value-object/data-set.ts';
import { viewDataSet } from './interface-design/view/data-set.ts';

afterEach(closeOpenStores);
afterAll(removeData);

/** The refusal a command gets, or a failure when it is not refused. */
async function refusal(store: Store, definition: AnyCommand, input: unknown): Promise<StoreError> {
  try {
    await runCommand(store, definition, input);
  } catch (error) {
    if (error instanceof StoreError) return error;
    throw error;
  }
  throw new Error(`${definition.name} was not refused`);
}

// The data set with an endpoint under its command, of the Endpoint aggregate.
async function storeWithEndpoint(): Promise<Store> {
  const store = await commandDataSet();
  const data = domainModelBase(Object.fromEntries(['aggregate', 'entity', 'domain_event', 'command'].map((t) => [t, store.rows(t)])));
  data.endpoint = [{ id: 'TL-LEND-EP01', title: 'POST /loans', command_id: 'TL-LEND-CMD01', method: 'POST', route: '/loans', description: 'Opens a loan.' }];
  return storeOn(data);
}

describe('LA-PAT-AGGREGATE-COMMANDS-R13-T01 LA-PAT-AGGREGATE-COMMANDS-R13-T04 LA-PAT-AGGREGATE-COMMANDS-R13-T05 LA-PAT-AGGREGATE-COMMANDS-R13-T06 LA-PAT-AGGREGATE-COMMANDS-R13-T07 LA-PAT-AGGREGATE-COMMANDS-R13-T08 in the stage domains, a record is removed whole with what it holds, refused while anything outside references it', () => {
  describe('at the store', () => {
    const fresh = async () => {
      const root = writeData(everyKind());
      return { store: await openStore(root), root };
    };

    it('refuses a record others reference, saying what references it', async () => {
      const { store } = await fresh();
      const problems = await refusedBy(store, 'value-object remove-value-object', { id: 'TL-VO01' });
      expect(problems).toEqual([expect.objectContaining({ rule: 'referenced', message: expect.stringContaining('entity_field entity_id TL-LEND-EN01, position 2 (type_value_object_id)') })]);
      await store.close();
    });

    it('removes a record with its parts and the links it starts', async () => {
      const { store, root } = await fresh();
      // The step's links are its own, so they go with it.
      await run(store, 'use-case remove-flow-step', { id: 'TL-LEND-UC01-FL-S01' });
      for (const table of ['fulfills', 'invokes', 'exchanges_with']) {
        expect(store.rows(table)).toEqual([]);
        expect(readdirSync(path.join(root, 'data'))).not.toContain(`${table}.jsonl`);
      }
      // A use case goes whole, with its actors, setting values and its own links, once nothing outside it points at it.
      await run(store, 'product change-question', { id: 'TL-LEND-Q01', about: [] });
      await run(store, 'pattern-following stop-following-pattern', { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT' });
      await run(store, 'interface change-interface', { id: 'TL-IF01', offers: [] });
      await run(store, 'integration change-integration', { id: 'TL-INT01', performs: [] });
      await run(store, 'use-case remove-use-case', { id: 'TL-LEND-UC01' });
      for (const table of ['use_case', 'use_case_actor', 'uc_requirement', 'flow', 'setting_value', 'follows']) expect(store.rows(table)).toEqual([]);
      // A table goes with its keys.
      await run(store, 'table remove-table', { id: 'TL-LEND-RM01-TB' });
      expect(store.rows('table_key').map((k) => k.table_id)).toEqual(['TL-LEND-EN01-TB', 'TL-LEND-EN01-TB']);
      await store.close();
    });
  });


  describe('an aggregate, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
    it('removes an entity with its fields and data model, an invariant with its test, and a data model and test alone', async () => {
      const store = await aggregateDataSet();
      expect((await refusal(store, REMOVE_ENTITY, { id: 'TL-LEND-EN02' })).problems[0]).toMatchObject({ rule: 'referenced', message: 'Entity TL-LEND-EN02 is referenced, so it stays: TL-LEND-EN01 has one TL-LEND-EN02' });
      const entity = await runCommand(store, REMOVE_ENTITY, { id: 'TL-LEND-EN01' });
      expect(entity.changes.map((c) => c.table).sort()).toEqual(['data_model', 'entity', 'entity_field', 'entity_field', 'entity_field', 'has_one', 'meets']);
      const invariant = await runCommand(store, REMOVE_INVARIANT, { id: 'TL-LEND-INV01' });
      expect(invariant.changes.map((c) => c.table).sort()).toEqual(['invariant', 'invariant_test', 'starts_from']);
      await runCommand(store, ADD_INVARIANT, { id: 'TL-LEND-INV02', title: 'A tool has a name', aggregate_id: 'TL-LEND-A2', statement: 'A tool MUST have a name.' });
      expect((await refusal(store, REMOVE_INVARIANT_TEST, { id: 'TL-LEND-INV09-T' })).problems[0].rule).toBe('missing');
      expect((await refusal(store, REMOVE_DATA_MODEL, { id: 'TL-LEND-EN01-DM' })).problems[0].rule).toBe('missing');
    });

    it('removes an aggregate whole, and refuses one while another aggregate references what is in it', async () => {
      const store = await aggregateDataSet();
      // The Loan's Tool field names TL-LEND-A2, so the Tool stays.
      expect((await refusal(store, REMOVE_AGGREGATE, { id: 'TL-LEND-A2' })).problems[0].message).toBe('Aggregate TL-LEND-A2 is referenced, so it stays: entity_field entity_id TL-LEND-EN01, position 2 (type_aggregate_id)');
      const removed = await runCommand(store, REMOVE_AGGREGATE, { id: 'TL-LEND-A1' });
      expect(new Set(removed.changes.map((c) => c.table))).toEqual(new Set(['aggregate', 'entity', 'entity_field', 'has_one', 'data_model', 'meets', 'invariant', 'invariant_test', 'starts_from']));
      expect(removed.changes.every((c) => c.after === null)).toBe(true);
      await runCommand(store, REMOVE_AGGREGATE, { id: 'TL-LEND-A2' });
    });
  });

  describe('a domain event, or its event type, is removed with what it holds, refused while anything outside references it', () => {
    it('removes an event type with its links, and an event whole with its fields and event type', async () => {
      const store = await domainEventDataSet();
      expect((await runCommand(store, REMOVE_EVENT_TYPE, { id: 'TL-LEND-EV01-ET' })).changes.map((c) => c.table).sort()).toEqual(['event_type', 'meets']);
      await runCommand(store, ADD_EVENT_TYPE, { id: 'TL-LEND-EV01-ET', title: 'LoanOpened', domain_event_id: 'TL-LEND-EV01' });
      const removed = await runCommand(store, REMOVE_DOMAIN_EVENT, { id: 'TL-LEND-EV01' });
      expect(removed.changes.map((c) => c.table).sort()).toEqual(['domain_event', 'event_field', 'event_field', 'event_type']);
    });

    it('refuses removing an event a command raises, naming the command', async () => {
      const store = await domainEventDataSet({
        entity: [{ id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' }],
        command: [{ id: 'TL-LEND-CMD01', title: 'Close a loan', entity_id: 'TL-LEND-EN01', description: 'Takes a tool back.' }],
      });
      await runCommand(store, CHANGE_COMMAND, { id: 'TL-LEND-CMD01', raises: ['TL-LEND-EV02'] });
      expect((await refusal(store, REMOVE_DOMAIN_EVENT, { id: 'TL-LEND-EV02' })).problems[0]).toMatchObject({ rule: 'referenced', message: 'Domain event TL-LEND-EV02 is referenced, so it stays: TL-LEND-CMD01 raises TL-LEND-EV02' });
    });
  });

  describe('a command, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
    it('removes a handler, an event handler, a policy test and a policy with what is under it', async () => {
      const store = await commandDataSet();
      expect((await runCommand(store, REMOVE_COMMAND_HANDLER, { id: 'TL-LEND-CMD01-H' })).changes.map((c) => c.table).sort()).toEqual(['command_handler', 'meets']);
      expect((await runCommand(store, REMOVE_POLICY_TEST, { id: 'TL-LEND-PO01-T' })).changes.map((c) => c.table).sort()).toEqual(['policy_test', 'starts_from']);
      expect((await runCommand(store, REMOVE_EVENT_HANDLER, { id: 'TL-LEND-PO01-H' })).changes.map((c) => c.table)).toEqual(['event_handler']);
      await runCommand(store, ADD_EVENT_HANDLER, { id: 'TL-LEND-PO01-H', title: 'onLoanOpened', policy_id: 'TL-LEND-PO01', description: 'Hears it.' });
      expect((await runCommand(store, REMOVE_POLICY, { id: 'TL-LEND-PO01' })).changes.map((c) => c.table).sort()).toEqual(['event_handler', 'hears', 'policy']);
    });

    it('removes a command whole, and refuses one while anything outside it references it', async () => {
      const store = await commandDataSet();
      const removed = await runCommand(store, REMOVE_COMMAND, { id: 'TL-LEND-CMD01' });
      expect(new Set(removed.changes.map((c) => c.table))).toEqual(new Set(['command', 'command_handler', 'policy', 'event_handler', 'policy_test', 'raises', 'checks', 'calls', 'hears', 'meets', 'starts_from']));
      const referenced = await storeWithEndpoint();
      expect((await refusal(referenced, REMOVE_COMMAND, { id: 'TL-LEND-CMD01' })).problems[0].message).toBe('Command TL-LEND-CMD01 is referenced, so it stays: endpoint TL-LEND-EP01 (command_id)');
    });
  });

  describe('a specification, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
    it('removes a predicate and a test with the links they start, then the specification whole', async () => {
      const store = await specificationDataSet();
      expect((await runCommand(store, REMOVE_PREDICATE, { id: 'TL-LEND-SP02-PR' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'package_use', 'predicate']);
      expect((await runCommand(store, REMOVE_SPECIFICATION_TEST, { id: 'TL-LEND-SP02-T' })).changes.map((c) => c.table).sort()).toEqual(['specification_test', 'starts_from']);
      await runCommand(store, ADD_PREDICATE, { id: 'TL-LEND-SP02-PR', title: 'isAtLoanLimit', specification_id: 'TL-LEND-SP02' });
      expect((await runCommand(store, REMOVE_SPECIFICATION, { id: 'TL-LEND-SP02' })).changes.map((c) => c.table).sort()).toEqual(['predicate', 'reads', 'specification']);
    });

    it('refuses to remove a specification a query selects by, naming it', async () => {
      const data = domainModelBase({
        ...SPECIFICATION_AROUND,
        read_model: [{ id: 'TL-LEND-RM01', title: 'Catalog', domain_id: 'TL-LEND', description: 'Every tool.' }],
        query: [{ id: 'TL-LEND-QRY01', title: 'List free tools', read_model_id: 'TL-LEND-RM01', description: 'The free tools.' }],
        selects_by: [{ source_id: 'TL-LEND-QRY01', target_id: 'TL-LEND-SP01' }],
      });
      const store = await storeOn(data);
      expect((await refusal(store, REMOVE_SPECIFICATION, { id: 'TL-LEND-SP01' })).problems[0].message).toBe('Specification TL-LEND-SP01 is referenced, so it stays: TL-LEND-QRY01 selects by TL-LEND-SP01');
    });
  });

  describe('a value object, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
    it('removes a constraint with its test, a value type, then the value object whole', async () => {
      const store = await valueObjectDataSet();
      expect((await runCommand(store, REMOVE_CONSTRAINT_TEST, { id: 'TL-VO01-C01-T' })).changes.map((c) => c.table).sort()).toEqual(['constraint_test', 'starts_from']);
      await runCommand(store, ADD_CONSTRAINT_TEST, { id: 'TL-VO01-C01-T', title: 'One at sign', constraint_id: 'TL-VO01-C01', level: 'unit', state: 'not automated yet', accepts: 'a@b', refuses: 'a@b@c' });
      expect((await runCommand(store, REMOVE_CONSTRAINT, { id: 'TL-VO01-C01' })).changes.map((c) => c.table).sort()).toEqual(['constraint', 'constraint_test']);
      expect((await runCommand(store, REMOVE_VALUE_TYPE, { id: 'TL-VO01-VT' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'value_type']);
      expect((await runCommand(store, REMOVE_VALUE_OBJECT, { id: 'TL-VO01' })).changes.map((c) => c.table).sort()).toEqual(['value_object', 'value_object_field']);
    });

    it('refuses to remove a value object a field types, naming it', async () => {
      const store = await storeOn(
        domainModelBase({
          value_object: [{ id: 'TL-VO01', title: 'Email address', description: 'How the library reaches a member.' }],
          aggregate: [{ id: 'TL-LEND-A2', title: 'Member', domain_id: 'TL-LEND', identity: 'Member ID', description: 'Someone who borrows tools.' }],
          entity: [{ id: 'TL-LEND-EN03', title: 'Member', aggregate_id: 'TL-LEND-A2', role: 'root', description: 'The member.' }],
          entity_field: [{ entity_id: 'TL-LEND-EN03', position: 1, name: 'Email', meaning: 'How to reach them.', type_value_object_id: 'TL-VO01', required: true }],
        }),
      );
      expect((await refusal(store, REMOVE_VALUE_OBJECT, { id: 'TL-VO01' })).problems[0].message).toMatch(/^Value object TL-VO01 is referenced, so it stays: .*TL-LEND-EN03/);
    });
  });

  describe('a read model, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
    it('removes a query handler, a projection, a reader and a query with its handler, then the read model whole', async () => {
      const store = await readModelDataSet();
      expect((await runCommand(store, REMOVE_READER, { id: 'TL-LEND-RM01-RD' })).changes.map((c) => c.table)).toEqual(['reader']);
      expect((await runCommand(store, REMOVE_QUERY_HANDLER, { id: 'TL-LEND-QRY01-H' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'query_handler']);
      expect((await runCommand(store, REMOVE_PROJECTION, { id: 'TL-LEND-RM01-PJ' })).changes.map((c) => c.table)).toEqual(['projection']);
      await runCommand(store, ADD_QUERY_HANDLER, { id: 'TL-LEND-QRY01-H', title: 'listCatalog', query_id: 'TL-LEND-QRY01', description: 'Reads it.' });
      expect((await runCommand(store, REMOVE_QUERY, { id: 'TL-LEND-QRY01' })).changes.map((c) => c.table).sort()).toEqual(['query', 'query_handler', 'selects_by']);
      expect(new Set((await runCommand(store, REMOVE_READ_MODEL, { id: 'TL-LEND-RM01' })).changes.map((c) => c.table))).toEqual(new Set(['read_model', 'read_model_field', 'reads', 'calls', 'fed_by']));
    });

    it('refuses to remove a read model while its table stores it, naming the table', async () => {
      const store = await readModelDataSet();
      const data = domainModelBase({ ...READ_MODEL_AROUND, read_model: store.rows('read_model'), table: [{ id: 'TL-LEND-RM01-TB', title: 'catalog', read_model_id: 'TL-LEND-RM01', name: 'catalog', storage: 'view' }] });
      const referenced = await storeOn(data);
      expect((await refusal(referenced, REMOVE_READ_MODEL, { id: 'TL-LEND-RM01' })).problems[0].message).toBe('Read model TL-LEND-RM01 is referenced, so it stays: table TL-LEND-RM01-TB (read_model_id)');
    });
  });

  describe('a table is removed whole, refused while anything outside references it', () => {
    it('removes a table with its keys and links, and refuses one another table points at, naming it', async () => {
      const store = await tableDataSet();
      expect((await refusal(store, REMOVE_TABLE, { id: 'TL-LEND-EN01-TB' })).problems[0].message).toBe('Table TL-LEND-EN01-TB is referenced, so it stays: table_key table_id TL-LEND-TB01, position 2 (target_table_id)');
      expect((await runCommand(store, REMOVE_TABLE, { id: 'TL-LEND-TB01' })).changes.map((c) => c.table).sort()).toEqual(['table', 'table_key', 'table_key']);
      expect((await runCommand(store, REMOVE_TABLE, { id: 'TL-LEND-EN01-TB' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'table', 'table_key', 'table_key']);
    });
  });

  describe('a view, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
    it('removes a test alone, a requirement with its tests, and a view whole', async () => {
      const store = await viewDataSet();
      expect((await runCommand(store, REMOVE_VIEW_TEST, { id: 'TL-V01-R01-T01' })).changes.map((c) => c.table).sort()).toEqual(['starts_from', 'view_test']);
      await runCommand(store, CHANGE_VIEW_REQUIREMENT, { id: 'TL-V01-R01', title: 'Due dates show' });
      expect((await runCommand(store, REMOVE_VIEW_REQUIREMENT, { id: 'TL-V01-R01' })).changes.map((c) => c.table)).toEqual(['view_requirement']);
      await runCommand(store, ADD_VIEW_REQUIREMENT, { id: 'TL-V02-R01', title: 'Overdue loans first', view_id: 'TL-V02', statement: 'Overdue loans MUST come first.' });
      const removed = await runCommand(store, REMOVE_VIEW, { id: 'TL-V02' });
      expect(removed.changes.map((c) => c.table).sort()).toEqual(['view', 'view_requirement']);
    });

    it('refuses a view a UI component renders, naming the link', async () => {
      const store = await viewDataSet();
      expect((await refusal(store, REMOVE_VIEW, { id: 'TL-V01' })).problems[0].message).toBe('View TL-V01 is referenced, so it stays: TL-UI01 renders TL-V01');
    });
  });

  describe('an endpoint, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
    it('removes a test, a handler with its links, a requirement with its tests, and an endpoint whole', async () => {
      const store = await endpointDataSet();
      expect((await runCommand(store, REMOVE_ENDPOINT_TEST, { id: 'TL-LEND-EP01-R01-T01' })).changes.map((c) => c.table).sort()).toEqual(['endpoint_test', 'starts_from']);
      expect((await runCommand(store, REMOVE_ENDPOINT_HANDLER, { id: 'TL-LEND-EP01-H' })).changes.map((c) => c.table).sort()).toEqual(['endpoint_handler', 'meets']);
      expect((await runCommand(store, REMOVE_API_REQUIREMENT, { id: 'TL-LEND-EP01-R01' })).changes.map((c) => c.table)).toEqual(['api_requirement']);
      expect((await runCommand(store, REMOVE_ENDPOINT, { id: 'TL-LEND-EP01' })).changes.map((c) => c.table)).toEqual(['endpoint']);
    });

    it('removes an endpoint whole with everything in it, and refuses one an open question is about, naming the link', async () => {
      const store = await endpointDataSet({ role: [{ product_id: 'TL', name: 'Librarian', description: 'Runs the library.' }] });
      await runCommand(store, ADD_QUESTION, { id: 'TL-LEND-Q01', title: 'Should a loan take a due date', domain_id: 'TL-LEND', owner: 'Librarian', description: 'Undecided.', about: ['TL-LEND-EP01-R01'] });
      expect((await refusal(store, REMOVE_ENDPOINT, { id: 'TL-LEND-EP01' })).problems[0].message).toBe('Endpoint TL-LEND-EP01 is referenced, so it stays: TL-LEND-Q01 about TL-LEND-EP01-R01');
      await runCommand(store, CHANGE_QUESTION, { id: 'TL-LEND-Q01', about: [] });
      const removed = await runCommand(store, REMOVE_ENDPOINT, { id: 'TL-LEND-EP01' });
      expect(new Set(removed.changes.map((c) => c.table))).toEqual(new Set(['endpoint', 'api_requirement', 'endpoint_test', 'starts_from', 'endpoint_handler', 'meets']));
    });
  });

  describe('an integration, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
    it('removes a test, an adapter with its links and packages, and an integration whole', async () => {
      const store = await integrationDataSet();
      expect((await runCommand(store, REMOVE_INTEGRATION_TEST, { id: 'TL-INT01-T01' })).changes.map((c) => c.table).sort()).toEqual(['integration_test', 'starts_from']);
      expect((await runCommand(store, REMOVE_ADAPTER, { id: 'TL-INT01-AD' })).changes.map((c) => c.table).sort()).toEqual(['adapter', 'meets', 'package_use']);
      const removed = await integrationDataSet();
      expect(new Set((await runCommand(removed, REMOVE_INTEGRATION, { id: 'TL-INT01' })).changes.map((c) => c.table))).toEqual(new Set(['integration', 'adapter', 'meets', 'package_use', 'integration_test', 'starts_from']));
    });

    it('refuses an integration an open question is about, naming the link', async () => {
      const store = await integrationDataSet({ role: [{ product_id: 'TL', name: 'Librarian', description: 'Runs the library.' }] });
      await runCommand(store, ADD_QUESTION, { id: 'TL-Q02', title: 'Which payments service', product_id: 'TL', owner: 'Librarian', description: 'Undecided.', about: ['TL-INT02'] });
      expect((await refusal(store, REMOVE_INTEGRATION, { id: 'TL-INT02' })).problems[0].message).toBe('Integration TL-INT02 is referenced, so it stays: TL-Q02 about TL-INT02');
    });
  });

  describe('a UI component is removed whole with the links it starts, refused while anything outside references it', () => {
    it('removes a UI component with its renders, meets and package rows', async () => {
      const store = await uiComponentDataSet();
      expect((await runCommand(store, REMOVE_UI_COMPONENT, { id: 'TL-UI01' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'package_use', 'renders', 'ui_component']);
    });

    it('refuses a UI component an open question is about, naming the link', async () => {
      const store = await uiComponentDataSet({ role: [{ product_id: 'TL', name: 'Librarian', description: 'Runs the library.' }] });
      await runCommand(store, ADD_QUESTION, { id: 'TL-Q01', title: 'Split the catalog page', product_id: 'TL', owner: 'Librarian', description: 'Undecided.', about: ['TL-UI01'] });
      expect((await refusal(store, REMOVE_UI_COMPONENT, { id: 'TL-UI01' })).problems[0].message).toBe('UI component TL-UI01 is referenced, so it stays: TL-Q01 about TL-UI01');
    });
  });

  describe('a storage requirement, or a test in one, is removed with what it holds', () => {
    it('removes a storage requirement test with the links it starts, then the storage requirement whole', async () => {
      const store = await storageRequirementDataSet();
      expect((await runCommand(store, REMOVE_STORAGE_REQUIREMENT_TEST, { id: 'TL-LEND-A1-SR01-T01' })).changes.map((c) => c.table).sort()).toEqual(['starts_from', 'storage_requirement_test']);
      expect((await runCommand(store, REMOVE_STORAGE_REQUIREMENT, { id: 'TL-LEND-A1-SR01' })).changes.map((c) => c.table).sort()).toEqual(['storage_requirement', 'storage_requirement_test']);
    });
  });

  describe('a data store nothing is stored in or provides is removed whole', () => {
    it('removes a data store once nothing is stored in it and its provider is removed', async () => {
      const store = await dataStoreDataSet();
      await runCommand(store, CHANGE_REPOSITORY, { id: 'TL-LEND-REPO01', stored_in: null });
      await runCommand(store, CHANGE_TABLE, { id: 'TL-LEND-EN01-TB', stored_in: null });
      expect((await refusal(store, REMOVE_DATA_STORE, { id: 'TL-STORE01' })).problems[0].message).toBe('Data store TL-STORE01 is referenced, so it stays: TL-STORE01 provided by TL-INT01');
      await runCommand(store, REMOVE_PROVIDER, { record_id: 'TL-STORE01' });
      expect((await runCommand(store, REMOVE_DATA_STORE, { id: 'TL-STORE01' })).changes.map((c) => c.table)).toEqual(['data_store']);
    });
  });
});
