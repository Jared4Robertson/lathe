// The record-keeping use cases of Interface design (LA-IXD-UC101 to UC122): an Agent or the Owner changes or removes a
// view, endpoint or integration and what sits under it, or adds a test, a handler or a requirement's test, each through
// the aggregate's own command, which is refused with its reason when it names a record that is not there and changes
// nothing, and is applied otherwise.
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_ENDPOINT } from '../../../src/interface-design/endpoint/commands/add-endpoint.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { closeOpenStores } from '../../domain-modeling/domain-model-base.ts';
import { endpointDataSet } from '../../interface-design/endpoint/data-set.ts';
import { integrationDataSet } from '../../interface-design/integration/data-set.ts';
import { viewDataSet } from '../../interface-design/view/data-set.ts';
import { keep } from './keep.ts';

afterEach(closeOpenStores);

/** An endpoint with no handler yet, TL-LEND-EP02, besides the data set's. */
async function endpointWithoutHandler() {
  const store = await endpointDataSet();
  await runCommand(store, ADD_ENDPOINT, { id: 'TL-LEND-EP02', title: 'GET /loans', query_id: 'TL-LEND-QRY01', method: 'GET', route: '/loans', description: 'The loans of a member.' });
  return store;
}

describe('the commands that keep a view and what sits under it', () => {
  it('LA-IXD-UC101-R01-T01 LA-IXD-UC101-FL-T Change a view is refused for a view that is not there, or applied', () =>
    keep({ set: viewDataSet, command: 'LA-IXD-CMD311', table: 'view', input: { id: 'TL-V01', title: 'Tools' }, missing: { id: 'TL-V09', title: 'Tools' }, applied: (s) => expect(s.record('TL-V01')?.row).toMatchObject({ title: 'Tools' }) }));
  it('LA-IXD-UC102-R01-T01 LA-IXD-UC102-FL-T Change a view requirement is refused for one that is not there, or applied', () =>
    keep({ set: viewDataSet, command: 'LA-IXD-CMD314', table: 'view_requirement', input: { id: 'TL-V01-R01', title: 'A loaned tool shows when it is due' }, missing: { id: 'TL-V01-R09', title: 'x' }, applied: (s) => expect(s.record('TL-V01-R01')?.row).toMatchObject({ title: 'A loaned tool shows when it is due' }) }));
  it('LA-IXD-UC103-R01-T01 LA-IXD-UC103-FL-T Remove a view requirement is refused for one that is not there, or applied with its tests', () =>
    keep({ set: viewDataSet, command: 'LA-IXD-CMD315', table: 'view_requirement', input: { id: 'TL-V01-R01' }, missing: { id: 'TL-V01-R09' }, applied: (s) => { expect(s.record('TL-V01-R01')).toBeUndefined(); expect(s.record('TL-V01-R01-T01')).toBeUndefined(); } }));
  it('LA-IXD-UC104-R01-T01 LA-IXD-UC104-FL-T Add a view test is refused under a requirement that is not there, or applied', () =>
    keep({ set: viewDataSet, command: 'LA-IXD-CMD316', table: 'view_test', input: { id: 'TL-V01-R01-T02', title: 'A due date reads in full', view_requirement_id: 'TL-V01-R01', level: 'browser', state: 'not automated yet', when: 'Opens the catalog.', then: 'The due date reads in full.' }, missing: { id: 'TL-V01-R09-T01', title: 'x', view_requirement_id: 'TL-V01-R09', level: 'browser', state: 'not automated yet', when: 'x', then: 'y' }, applied: (s) => expect(s.record('TL-V01-R01-T02')?.row).toMatchObject({ view_requirement_id: 'TL-V01-R01' }) }));
  it('LA-IXD-UC105-R01-T01 LA-IXD-UC105-FL-T Change a view test is refused for one that is not there, or applied', () =>
    keep({ set: viewDataSet, command: 'LA-IXD-CMD317', table: 'view_test', input: { id: 'TL-V01-R01-T01', state: 'manual', manual_reason: 'Needs a person.' }, missing: { id: 'TL-V01-R01-T09', state: 'manual', manual_reason: 'x' }, applied: (s) => expect(s.record('TL-V01-R01-T01')?.row).toMatchObject({ state: 'manual' }) }));
  it('LA-IXD-UC106-R01-T01 LA-IXD-UC106-FL-T Remove a view test is refused for one that is not there, or applied', () =>
    keep({ set: viewDataSet, command: 'LA-IXD-CMD318', table: 'view_test', input: { id: 'TL-V01-R01-T01' }, missing: { id: 'TL-V01-R01-T09' }, applied: (s) => expect(s.record('TL-V01-R01-T01')).toBeUndefined() }));
});

describe('the commands that keep an endpoint and what sits under it', () => {
  it('LA-IXD-UC107-R01-T01 LA-IXD-UC107-FL-T Change an endpoint is refused for one that is not there, or applied', () =>
    keep({ set: endpointDataSet, command: 'LA-IXD-CMD321', table: 'endpoint', input: { id: 'TL-LEND-EP01', notes: 'Idempotent by request ID.' }, missing: { id: 'TL-LEND-EP09', notes: 'x' }, applied: (s) => expect(s.record('TL-LEND-EP01')?.row).toMatchObject({ notes: 'Idempotent by request ID.' }) }));
  it('LA-IXD-UC108-R01-T01 LA-IXD-UC108-FL-T Remove an endpoint is refused for one that is not there, or applied whole', () =>
    keep({ set: endpointDataSet, command: 'LA-IXD-CMD323', table: 'endpoint', input: { id: 'TL-LEND-EP01' }, missing: { id: 'TL-LEND-EP09' }, applied: (s) => { for (const id of ['TL-LEND-EP01', 'TL-LEND-EP01-R01', 'TL-LEND-EP01-R01-T01', 'TL-LEND-EP01-H']) expect(s.record(id)).toBeUndefined(); } }));
  it('LA-IXD-UC109-R01-T01 LA-IXD-UC109-FL-T Change a requirement of an endpoint is refused for one that is not there, or applied', () =>
    keep({ set: endpointDataSet, command: 'LA-IXD-CMD325', table: 'api_requirement', input: { id: 'TL-LEND-EP01-R01', group_name: 'Errors' }, missing: { id: 'TL-LEND-EP01-R09', group_name: 'Errors' }, applied: (s) => expect(s.record('TL-LEND-EP01-R01')?.row).toMatchObject({ group_name: 'Errors' }) }));
  it('LA-IXD-UC110-R01-T01 LA-IXD-UC110-FL-T Remove a requirement of an endpoint is refused for one that is not there, or applied with its tests', () =>
    keep({ set: endpointDataSet, command: 'LA-IXD-CMD326', table: 'api_requirement', input: { id: 'TL-LEND-EP01-R01' }, missing: { id: 'TL-LEND-EP01-R09' }, applied: (s) => { expect(s.record('TL-LEND-EP01-R01')).toBeUndefined(); expect(s.record('TL-LEND-EP01-R01-T01')).toBeUndefined(); } }));
  it('LA-IXD-UC111-R01-T01 LA-IXD-UC111-FL-T Add an endpoint handler is refused for an endpoint that is not there, or applied', () =>
    keep({ set: endpointWithoutHandler, command: 'LA-IXD-CMD327', table: 'endpoint_handler', input: { id: 'TL-LEND-EP02-H', title: 'getLoans', endpoint_id: 'TL-LEND-EP02', description: 'Reads the request and runs List a member\'s loans.' }, missing: { id: 'TL-LEND-EP09-H', title: 'x', endpoint_id: 'TL-LEND-EP09', description: 'x' }, applied: (s) => expect(s.record('TL-LEND-EP02-H')?.row).toMatchObject({ endpoint_id: 'TL-LEND-EP02' }) }));
  it('LA-IXD-UC112-R01-T01 LA-IXD-UC112-FL-T Change an endpoint handler is refused for one that is not there, or applied', () =>
    keep({ set: endpointDataSet, command: 'LA-IXD-CMD328', table: 'endpoint_handler', input: { id: 'TL-LEND-EP01-H', file: null, meets: [], packages: ['hono'] }, missing: { id: 'TL-LEND-EP09-H', file: null }, applied: (s) => { expect(s.record('TL-LEND-EP01-H')?.row).not.toHaveProperty('file'); expect(JSON.stringify(s.rows('package_use'))).toContain('hono'); } }));
  it('LA-IXD-UC113-R01-T01 LA-IXD-UC113-FL-T Remove an endpoint handler is refused for one that is not there, or applied', () =>
    keep({ set: endpointDataSet, command: 'LA-IXD-CMD329', table: 'endpoint_handler', input: { id: 'TL-LEND-EP01-H' }, missing: { id: 'TL-LEND-EP09-H' }, applied: (s) => expect(s.record('TL-LEND-EP01-H')).toBeUndefined() }));
  it('LA-IXD-UC114-R01-T01 LA-IXD-UC114-FL-T Add an endpoint test is refused under a requirement that is not there, or applied', () =>
    keep({ set: endpointDataSet, command: 'LA-IXD-CMD330', table: 'endpoint_test', input: { id: 'TL-LEND-EP01-R01-T02', title: 'A free tool answers 201', api_requirement_id: 'TL-LEND-EP01-R01', level: 'service', state: 'not automated yet', when: 'POST /loans for a free tool.', then: '201 with the loan.' }, missing: { id: 'TL-LEND-EP01-R09-T01', title: 'x', api_requirement_id: 'TL-LEND-EP01-R09', level: 'service', state: 'not automated yet', when: 'x', then: 'y' }, applied: (s) => expect(s.record('TL-LEND-EP01-R01-T02')?.row).toMatchObject({ api_requirement_id: 'TL-LEND-EP01-R01' }) }));
  it('LA-IXD-UC115-R01-T01 LA-IXD-UC115-FL-T Change an endpoint test is refused for one that is not there, or applied', () =>
    keep({ set: endpointDataSet, command: 'LA-IXD-CMD331', table: 'endpoint_test', input: { id: 'TL-LEND-EP01-R01-T01', state: 'manual', manual_reason: 'Needs the live API.' }, missing: { id: 'TL-LEND-EP01-R01-T09', state: 'manual', manual_reason: 'x' }, applied: (s) => expect(s.record('TL-LEND-EP01-R01-T01')?.row).toMatchObject({ state: 'manual' }) }));
  it('LA-IXD-UC116-R01-T01 LA-IXD-UC116-FL-T Remove an endpoint test is refused for one that is not there, or applied', () =>
    keep({ set: endpointDataSet, command: 'LA-IXD-CMD332', table: 'endpoint_test', input: { id: 'TL-LEND-EP01-R01-T01' }, missing: { id: 'TL-LEND-EP01-R01-T09' }, applied: (s) => expect(s.record('TL-LEND-EP01-R01-T01')).toBeUndefined() }));
});

describe('the commands that keep an integration and what sits under it', () => {
  it('LA-IXD-UC117-R01-T01 LA-IXD-UC117-FL-T Change an integration is refused for one that is not there, or applied', () =>
    keep({ set: integrationDataSet, command: 'LA-IXD-CMD336', table: 'integration', input: { id: 'TL-INT01', description: 'Sends members their reminders.' }, missing: { id: 'TL-INT09', description: 'x' }, applied: (s) => expect(s.record('TL-INT01')?.row).toMatchObject({ description: 'Sends members their reminders.' }) }));
  it('LA-IXD-UC118-R01-T01 LA-IXD-UC118-FL-T Change an adapter is refused for one that is not there, or applied', () =>
    keep({ set: integrationDataSet, command: 'LA-IXD-CMD339', table: 'adapter', input: { id: 'TL-INT01-AD', description: 'Sends one mail.' }, missing: { id: 'TL-INT09-AD', description: 'x' }, applied: (s) => expect(s.record('TL-INT01-AD')?.row).toMatchObject({ description: 'Sends one mail.' }) }));
  it('LA-IXD-UC119-R01-T01 LA-IXD-UC119-FL-T Remove an adapter is refused for one that is not there, or applied', () =>
    keep({ set: integrationDataSet, command: 'LA-IXD-CMD340', table: 'adapter', input: { id: 'TL-INT01-AD' }, missing: { id: 'TL-INT09-AD' }, applied: (s) => expect(s.record('TL-INT01-AD')).toBeUndefined() }));
  it('LA-IXD-UC120-R01-T01 LA-IXD-UC120-FL-T Add an integration test is refused under an integration that is not there, or applied', () =>
    keep({ set: integrationDataSet, command: 'LA-IXD-CMD341', table: 'integration_test', input: { id: 'TL-INT02-T01', title: 'A late fee reaches the payments service', integration_id: 'TL-INT02', level: 'integration', state: 'manual', manual_reason: 'It needs the real payments service.', when: 'Takes a late fee.', then: 'The service accepts it.' }, missing: { id: 'TL-INT09-T01', title: 'x', integration_id: 'TL-INT09', level: 'integration', state: 'manual', manual_reason: 'x', when: 'x', then: 'y' }, applied: (s) => expect(s.record('TL-INT02-T01')?.row).toMatchObject({ integration_id: 'TL-INT02' }) }));
  it('LA-IXD-UC121-R01-T01 LA-IXD-UC121-FL-T Change an integration test is refused for one that is not there, or applied', () =>
    keep({ set: integrationDataSet, command: 'LA-IXD-CMD342', table: 'integration_test', input: { id: 'TL-INT01-T01', manual_reason: 'It needs the real mail service and its key.' }, missing: { id: 'TL-INT01-T09', manual_reason: 'x' }, applied: (s) => expect(s.record('TL-INT01-T01')?.row).toMatchObject({ manual_reason: 'It needs the real mail service and its key.' }) }));
  it('LA-IXD-UC122-R01-T01 LA-IXD-UC122-FL-T Remove an integration test is refused for one that is not there, or applied', () =>
    keep({ set: integrationDataSet, command: 'LA-IXD-CMD343', table: 'integration_test', input: { id: 'TL-INT01-T01' }, missing: { id: 'TL-INT01-T09' }, applied: (s) => expect(s.record('TL-INT01-T01')).toBeUndefined() }));
});
