// The Use case aggregate's own reads, each answered from its read model (LA-UCS-RM11) through its reader (reader.ts),
// which the query runner gives each handler: a use case whole as its page reads it, a domain's use cases by group, and
// the next free ID for a record of one of its kinds. A handler never sees the data, a repository or the aggregate's
// model; each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { UseCaseKind } from './model.ts';
import type { UseCasePage, UseCasesOfGroup } from './read-model.ts';
import { useCaseReader, type UseCaseReader } from './reader.ts';
import { GET_USE_CASE_IDENTITY, LIST_USE_CASES_IDENTITY, NEXT_USE_CASE_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The use case that holds the record, as its page reads it: the use case itself, or one of its requirements, flows, steps or tests. */
export function getUseCase(reader: UseCaseReader, input: { id: string }): UseCasePage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${kind === 'interface' ? 'an' : 'a'} ${kind}, not a use case or a record in one`);
}

/** GET a use case whole (LA-UCS-QRY100). */
export const GET_USE_CASE: QueryDefinition<{ id: string }, UseCasePage, UseCaseReader> = {
  ...GET_USE_CASE_IDENTITY,
  input: { id: id('The use case, or a requirement, flow, step or test in it.', 'required') },
  reader: useCaseReader,
  run: getUseCase,
  text: useCaseText,
};

/** A domain's use cases by group: aggregates by ID, then read models by ID, and the use cases of each by ID. */
export function listUseCases(reader: UseCaseReader, input: { domain_id: string }): UseCasesOfGroup[] {
  return reader.useCasesOf(input.domain_id) ?? refuse('missing', `there is no domain ${input.domain_id}`);
}

/** List a domain's use cases (LA-UCS-QRY101). */
export const LIST_USE_CASES: QueryDefinition<{ domain_id: string }, UseCasesOfGroup[], UseCaseReader> = {
  ...LIST_USE_CASES_IDENTITY,
  input: { domain_id: id('The domain.', 'required') },
  reader: useCaseReader,
  run: listUseCases,
  text: (groups) =>
    groups.length
      ? groups.map((g) => [`${g.group.kind === 'aggregate' ? 'Aggregate' : 'Read model'} ${g.group.id}  ${g.group.title}`, ...g.useCases.map((r) => `  ${r.id}  ${r.title}`)].join('\n')).join('\n')
      : 'No use cases.',
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['use_case', 'uc_requirement', 'use_case_test', 'flow', 'flow_step', 'flow_test'];

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: one past the highest in use. A use
 * case's starts with its domain's; a use case has one flow, whose ID is the use case's and FL, and a flow
 * one flow test, whose ID is the flow's and T.
 */
export function nextUseCaseId(reader: UseCaseReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Use case aggregate; its kinds are ${KINDS.join(', ')}`);
  const kind = input.kind as UseCaseKind;
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== shape.parents[0]) refuse('parent', `a ${kind} sits under a ${shape.parents[0]}, and ${input.parent} is ${parentKind ? `a ${parentKind}` : 'no record'}`);
  switch (kind) {
    case 'use_case':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
    case 'uc_requirement':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
    case 'use_case_test':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
    case 'flow_step':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
    case 'flow_test':
    case 'flow': {
      const one = `${input.parent}-${shape.letters}`;
      if (reader.kindOf(one)) refuse('exists', `${input.parent} already has its ${kind === 'flow' ? 'flow' : 'flow test'}, ${one}`);
      return one;
    }
  }
}

/** Get the next ID for a record of the Use case aggregate (LA-UCS-QRY102). */
export const NEXT_USE_CASE_ID: QueryDefinition<{ kind: string; parent: string }, string, UseCaseReader> = {
  ...NEXT_USE_CASE_ID_IDENTITY,
  input: {
    kind: id('The kind: use_case, uc_requirement, use_case_test, flow, flow_step or flow_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  reader: useCaseReader,
  run: nextUseCaseId,
  text: (next) => next,
};

/** A use case as text: its row, its actors, then each requirement and flow with what is under it. */
function useCaseText(page: UseCasePage): string {
  const { useCase: row } = page;
  const group = page.group ? [`  ${page.group.kind === 'aggregate' ? 'aggregate' : 'read model'}: ${page.group.id} ${page.group.title}`] : [];
  const lines = [`Use case ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, ...group, `  result: ${page.result.id} (${page.result.kind})`, `  goal: ${row.goal}`];
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  if (page.actors.length) lines.push(`  actors: ${page.actors.join(', ')}`);
  for (const r of page.requirements) {
    lines.push(`UC requirement ${r.requirement.id}: ${r.requirement.title}`);
    for (const t of r.tests) lines.push(`  use case test ${t.test.id}: ${t.test.title} (${t.test.state})`);
  }
  for (const f of page.flows) {
    lines.push(`Flow ${f.flow.id}: ${f.flow.title}`);
    for (const s of f.paths.flatMap((p) => p.steps)) {
      const links = [...s.fulfills.map((x) => `fulfills ${x}`), ...(s.invokes ? [`invokes ${s.invokes}`] : []), ...s.exchangesWith.map((x) => `exchanges with ${x}`)];
      const variant = s.step.interface_id ? ` (only through ${s.step.interface_id})` : '';
      lines.push(`  ${s.step.path} ${s.step.position}. ${s.step.id}: ${s.step.title}${variant}${links.length ? ` [${links.join('; ')}]` : ''}`);
    }
    if (f.test) lines.push(`  flow test ${f.test.test.id}: ${f.test.test.title} (${f.test.test.state})`);
    for (const t of f.through) {
      lines.push(`  through ${t.interface} (${t.kind}${t.actor ? `, by the ${t.actor}` : ''}):`);
      for (const s of t.paths.flatMap((p) => p.steps)) lines.push(`    ${s.id}${s.reach.length ? ` in ${s.reach.join(', ')}` : ''}${s.unreached ? ' (not reached)' : ''}`);
    }
  }
  return lines.join('\n');
}
