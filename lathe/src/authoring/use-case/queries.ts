// The Use case aggregate's own reads, each answered from its read model (LA-AUT-RM11, read-model.ts): a use case whole
// as its page reads it, the use cases of a capability, and the next free ID for a record of one of its kinds. Each reads
// the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { USE_CASE_SLICE, type UseCaseKind } from './model.ts';
import { stepsOf, useCasePageFrom, useCaseSummariesFrom, type UseCasePage, type UseCaseSummary } from './read-model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The use case that holds the record, as its page reads it: the use case itself, or one of its requirements, flows, steps or tests. */
export function getUseCase(view: ReadView, input: { id: string }): UseCasePage {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return useCasePageFrom(view, input.id) ?? refuse('kind', `${input.id} is ${record.kind === 'interface' ? 'an' : 'a'} ${record.kind}, not a use case or a record in one`);
}

/** GET a use case whole (LA-AUT-QRY100). */
export const GET_USE_CASE: QueryDefinition<{ id: string }, UseCasePage> = {
  id: 'LA-AUT-QRY100',
  slice: USE_CASE_SLICE,
  name: 'get-use-case',
  description: 'Reads a use case whole as its page shows it, by its ID or the ID of any record in it: the record asked for and its kind, the use case\'s row and actors, its UC requirements each with its tests and the steps that fulfill it, and its flows by interface, each with its steps path by path in order (with the links each starts) and its flow test.',
  method: 'GET',
  route: '/api/use-case/get-use-case',
  input: { id: id('The use case, or a requirement, flow, step or test in it.', 'required') },
  run: getUseCase,
  text: useCaseText,
};

/** The use cases of a capability, by ID. */
export function listUseCases(view: ReadView, input: { capability_id: string }): UseCaseSummary[] {
  if (view.record(input.capability_id)?.kind !== 'capability') refuse('missing', `there is no capability ${input.capability_id}`);
  return useCaseSummariesFrom(view, input.capability_id);
}

/** List the use cases of a capability (LA-AUT-QRY101). */
export const LIST_USE_CASES: QueryDefinition<{ capability_id: string }, UseCaseSummary[]> = {
  id: 'LA-AUT-QRY101',
  slice: USE_CASE_SLICE,
  name: 'list-use-cases',
  description: 'Lists the use cases of a capability, by ID, with their titles.',
  method: 'GET',
  route: '/api/use-case/list-use-cases',
  input: { capability_id: id('The capability.', 'required') },
  run: listUseCases,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No use cases.'),
};

// One past the highest number in use after the prefix, padded to two digits.
function onePast(view: ReadView, prefix: string): string {
  const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let highest = 0;
  for (const kind of Object.keys(view.schema.kinds)) {
    for (const row of view.rows(kind)) {
      const m = shape.exec(String(row.id));
      if (m) highest = Math.max(highest, Number(m[1]));
    }
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** The kinds of the aggregate, each with the kind of record it sits under. */
const UNDER: Record<UseCaseKind, string> = {
  use_case: 'capability',
  uc_requirement: 'use_case',
  use_case_test: 'uc_requirement',
  flow: 'use_case',
  flow_step: 'flow',
  flow_test: 'flow',
};

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: one past the highest in use. A use
 * case's starts with its capability's domain; a flow's ends in the number of the first interface of its product it has
 * no flow through yet; a flow has one flow test, whose ID is the flow's and T.
 */
export function nextUseCaseId(view: ReadView, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Use case aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as UseCaseKind;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  switch (kind) {
    case 'use_case':
      return onePast(view, `${parent!.row.domain_id}-UC`);
    case 'uc_requirement':
      return onePast(view, `${input.parent}-R`);
    case 'use_case_test':
      return onePast(view, `${input.parent}-T`);
    case 'flow_step':
      return onePast(view, `${input.parent}-S`);
    case 'flow_test': {
      const testId = `${input.parent}-T`;
      if (view.record(testId)) refuse('exists', `${input.parent} already has its flow test, ${testId}`);
      return testId;
    }
    case 'flow': {
      const useCase = getUseCase(view, { id: input.parent });
      const capability = view.record(useCase.useCase.capability_id)!;
      const product = String(view.record(String(capability.row.domain_id))!.row.product_id);
      const through = new Set(useCase.flows.map((f) => f.flow.interface_id));
      const free = view.rows('interface').filter((i) => i.product_id === product && !through.has(String(i.id))).map((i) => String(i.id)).sort()[0];
      if (!free) refuse('exists', `${input.parent} has a flow through every interface of ${product}; a flow's ID ends in its interface's number, so declare the interface first`);
      return `${input.parent}-FL${/-IF(\d+)$/.exec(free!)![1]}`;
    }
  }
}

/** Get the next ID for a record of the Use case aggregate (LA-AUT-QRY102). */
export const NEXT_USE_CASE_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
  id: 'LA-AUT-QRY102',
  slice: USE_CASE_SLICE,
  name: 'next-id',
  description: 'The next free ID for a use case (under a capability), UC requirement or flow (under a use case), use case test (under a requirement), or flow step or flow test (under a flow): one past the highest in use.',
  method: 'GET',
  route: '/api/use-case/next-id',
  input: {
    kind: id('The kind: use_case, uc_requirement, use_case_test, flow, flow_step or flow_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  run: nextUseCaseId,
  text: (next) => next,
};

/** A use case as text: its row, its actors, then each requirement and flow with what is under it. */
function useCaseText(page: UseCasePage): string {
  const { useCase: row } = page;
  const lines = [`Use case ${row.id}: ${row.title}`, `  capability: ${row.capability_id}`, `  goal: ${row.goal}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  if (page.actors.length) lines.push(`  actors: ${page.actors.join(', ')}`);
  for (const r of page.requirements) {
    lines.push(`UC requirement ${r.requirement.id}: ${r.requirement.title}`);
    for (const t of r.tests) lines.push(`  use case test ${t.test.id}: ${t.test.title} (${t.test.state})`);
  }
  for (const f of page.flows) {
    lines.push(`Flow ${f.flow.id}: ${f.flow.title} (through ${f.flow.interface_id})`);
    for (const s of stepsOf(f)) {
      const links = [...s.fulfills.map((x) => `fulfills ${x}`), ...(s.invokes ? [`invokes ${s.invokes}`] : []), ...(s.happensIn ? [`happens in ${s.happensIn}`] : []), ...s.exchangesWith.map((x) => `exchanges with ${x}`)];
      lines.push(`  ${s.step.path} ${s.step.position}. ${s.step.id}: ${s.step.title}${links.length ? ` [${links.join('; ')}]` : ''}`);
    }
    if (f.test) lines.push(`  flow test ${f.test.test.id}: ${f.test.test.title} (${f.test.test.state})`);
  }
  return lines.join('\n');
}

/** The Use case aggregate's queries, as the CLI and the MCP server register them. */
export const USE_CASE_QUERIES: readonly AnyQuery[] = [GET_USE_CASE, LIST_USE_CASES, NEXT_USE_CASE_ID];
