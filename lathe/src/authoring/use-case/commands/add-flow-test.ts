// Add a flow test (LA-AUT-CMD116): Adds a flow test under its flow, with the test data sets it starts from.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { FlowTestRow } from '../../../platform/data/tables.ts';
import { USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new flow test, with the test data sets it starts from. */
export type AddFlowTest = Pick<FlowTestRow, 'id' | 'title' | 'flow_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'steps' | 'expected_result' | 'notes'> & { starts_from?: string[] };

/** Add a flow test (LA-AUT-CMD116). */
export const ADD_FLOW_TEST: CommandDefinition<AddFlowTest> = {
  id: 'LA-AUT-CMD116',
  slice: USE_CASE_SLICE,
  name: 'add-flow-test',
  description: 'Adds a flow test under its flow, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/use-case/add-flow-test',
  input: {
    id: column('flow_test', 'id', 'required'),
    title: column('flow_test', 'title', 'required'),
    flow_id: column('flow_test', 'flow_id', 'required'),
    level: column('flow_test', 'level', 'required'),
    state: column('flow_test', 'state', 'required'),
    file: column('flow_test', 'file', 'optional'),
    manual_reason: column('flow_test', 'manual_reason', 'optional'),
    size: column('flow_test', 'size', 'optional'),
    smoke: column('flow_test', 'smoke', 'optional'),
    external: column('flow_test', 'external', 'optional'),
    steps: column('flow_test', 'steps', 'required'),
    expected_result: column('flow_test', 'expected_result', 'required'),
    notes: column('flow_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addFlowTest,
};

/** Adds the test under its flow. */
export function addFlowTest(tx: Transaction, input: AddFlowTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow', input.flow_id) ?? tx.refuse('missing', `there is no flow ${input.flow_id}`);
  const { starts_from = [], ...row } = input;
  useCase.flowTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
