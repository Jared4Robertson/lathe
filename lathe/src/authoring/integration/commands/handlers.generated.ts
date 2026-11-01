// Generated from data/ by `npm run generate`. Do not edit.
// The integration commands whose handler is the pattern: load the integration, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { IntegrationRepository } from '../repository.ts';
import type { AddIntegration } from './add-integration.ts';
import type { ChangeIntegration } from './change-integration.ts';
import type { RemoveIntegration } from './remove-integration.ts';
import type { ChangeAdapter } from './change-adapter.ts';
import type { RemoveAdapter } from './remove-adapter.ts';
import type { AddIntegrationTest } from './add-integration-test.ts';
import type { ChangeIntegrationTest } from './change-integration-test.ts';
import type { RemoveIntegrationTest } from './remove-integration-test.ts';

/** Adds an integration: an outside system the product exchanges with. It has no owner; its product follows from its ID. */
export function addIntegration(tx: Transaction, input: AddIntegration): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.create({ root: input.id, integration: input, adapter: null, tests: [] });
  integrations.save(integration);
}

/** Changes an integration's title, system or description. */
export function changeIntegration(tx: Transaction, input: ChangeIntegration): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.load(input.id) ?? tx.refuse('missing', `there is no integration ${input.id}`);
  integration.integration = changed(integration.integration, input, ['title', 'description', 'system']);
  integrations.save(integration);
}

/** Removes an integration whole: its adapter, its integration tests and the links they start. Refused while anything outside it references what is in it. */
export function removeIntegration(tx: Transaction, input: RemoveIntegration): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.load(input.id) ?? tx.refuse('missing', `there is no integration ${input.id}`);
  integrations.remove(integration);
}

/** Changes an adapter's title, file or description, or the standard rules it meets or the packages it uses (each list whole). Its integration does not change. */
export function changeAdapter(tx: Transaction, input: ChangeAdapter): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('adapter', input.id) ?? tx.refuse('missing', `there is no adapter ${input.id}`);
  const held = integration.adapter!;
  integration.adapter = { row: changed(held.row, input, ['title', 'description', 'file']), meets: input.meets ?? held.meets, packages: input.packages ?? held.packages };
  integrations.save(integration);
}

/** Removes an adapter with the links it starts and the packages it uses. Refused while anything else references them. */
export function removeAdapter(tx: Transaction, input: RemoveAdapter): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('adapter', input.id) ?? tx.refuse('missing', `there is no adapter ${input.id}`);
  integration.adapter = null;
  integrations.save(integration);
}

/** Adds an integration test under its integration, with the test data sets it starts from. */
export function addIntegrationTest(tx: Transaction, input: AddIntegrationTest): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.load(input.integration_id) ?? tx.refuse('missing', `there is no integration ${input.integration_id}`);
  const { starts_from = [], ...row } = input;
  integration.tests.push({ row, startsFrom: starts_from });
  integrations.save(integration);
}

/** Changes an integration test's columns or the test data sets it starts from (the whole list). Its integration does not change. */
export function changeIntegrationTest(tx: Transaction, input: ChangeIntegrationTest): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('integration_test', input.id) ?? tx.refuse('missing', `there is no integration test ${input.id}`);
  integration.tests = integration.tests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'when', 'then', 'file', 'manual_reason', 'size', 'smoke', 'external', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  integrations.save(integration);
}

/** Removes an integration test with the links it starts. Refused while anything else references them. */
export function removeIntegrationTest(tx: Transaction, input: RemoveIntegrationTest): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('integration_test', input.id) ?? tx.refuse('missing', `there is no integration test ${input.id}`);
  integration.tests = integration.tests.filter((x) => x.row.id !== input.id);
  integrations.save(integration);
}
