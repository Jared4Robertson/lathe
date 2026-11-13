import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UseCaseRow } from '../../../platform/data/tables.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_USE_CASE_IDENTITY } from './identities.generated.ts';

/** The use case, the domain it moves to, and its result there when that changes too. */
export type MoveUseCase = Pick<UseCaseRow, 'id' | 'domain_id'> & { result_id?: UseCaseRow['result_id'] };

export const MOVE_USE_CASE = {
  ...MOVE_USE_CASE_IDENTITY,
  input: {
    id: column('use_case', 'id', 'required'),
    domain_id: column('use_case', 'domain_id', 'required'),
    result_id: column('use_case', 'result_id', 'optional'),
  },
  handler: moveUseCase,
} satisfies CommandDefinition<MoveUseCase>;

/** The domain a command or query sits in: its entity's aggregate's, or its read model's; undefined when it is neither. */
export function domainOfOperation(tx: Transaction, id: string): string | undefined {
  const operation = tx.record(id);
  const at = (ref: unknown) => (typeof ref === 'string' ? tx.record(ref) : undefined);
  const owner = operation?.kind === 'command' ? at(at(operation.row.entity_id)?.row.aggregate_id) : operation?.kind === 'query' ? at(operation.row.read_model_id) : undefined;
  return typeof owner?.row.domain_id === 'string' ? owner.row.domain_id : undefined;
}

/**
 * Refused unless the result (the given one, else the current one) belongs to the target domain. The renames come from
 * toDomain, made free there by freeInDomain, and the repository carries them to every row.
 */
export function moveUseCase(tx: Transaction, input: MoveUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.id) ?? tx.refuse('missing', `there is no use case ${input.id}`);
  const result = input.result_id ?? useCase.useCase.result_id;
  const resultDomain = domainOfOperation(tx, result) ?? tx.refuse('missing', `there is no command or query ${result} to be the result of ${input.id}`);
  if (resultDomain !== input.domain_id) {
    tx.refuse('use-case-result-in-domain', `${result} is of ${resultDomain}, not ${input.domain_id}: a use case sits in its result's domain, so give ${input.id} a result of ${input.domain_id} as it moves`);
  }
  const renames = freeInDomain(tx, input.id, input.domain_id, toDomain(tx, { id: input.id, label: 'use case', domainId: useCase.useCase.domain_id }, input.domain_id));
  useCase.useCase = { ...useCase.useCase, domain_id: input.domain_id, result_id: result };
  holdToRules(tx, useCase);
  useCases.save(useCase);
  useCases.carryRenames(renames);
}

/**
 * The renames with the use case's new ID free in its new domain: when a record already has the ID the move gives, the
 * use case takes the next number there, one past the highest use case in that domain, and what is in it follows its ID.
 */
function freeInDomain(tx: Transaction, id: string, domainId: string, renames: Map<string, string>): Map<string, string> {
  const given = renames.get(id);
  if (given === undefined || tx.record(given) === undefined) return renames;
  const prefix = `${domainId}-UC`;
  const numberOf = (other: string) => (other.startsWith(prefix) && /^\d+$/.test(other.slice(prefix.length)) ? Number(other.slice(prefix.length)) : 0);
  const highest = Math.max(0, ...tx.rows('use_case').map((u) => numberOf(String(u.id))));
  const free = `${prefix}${String(highest + 1).padStart(2, '0')}`;
  return new Map([...renames].map(([from, to]) => [from, to === given || to.startsWith(`${given}-`) ? `${free}${to.slice(given.length)}` : to]));
}

/**
 * Carries the use cases whose result is one of these commands or queries into the domain they have moved to, as an
 * aggregate or read model moves (Move an aggregate, Move a read model): each sits with its result, so it goes where its
 * result goes. A use case already in that domain stays.
 */
export function carryUseCasesWith(tx: Transaction, operations: readonly string[], domainId: string): void {
  const results = new Set(operations);
  const carried = tx
    .rows('use_case')
    .filter((u) => results.has(String(u.result_id)) && u.domain_id !== domainId)
    .map((u) => String(u.id));
  for (const id of carried) moveUseCase(tx, { id, domain_id: domainId });
}
