import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { AggregateRow } from '../../../platform/data/tables.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_AGGREGATE_IDENTITY } from './identities.generated.ts';
import { carryUseCasesWith } from '../../../use-cases/use-case/commands/move-use-case.ts';

/** The aggregate and the domain it moves to. */
export type MoveAggregate = Pick<AggregateRow, 'id' | 'domain_id'>;

export const MOVE_AGGREGATE = {
  ...MOVE_AGGREGATE_IDENTITY,
  input: {
    id: column('aggregate', 'id', 'required'),
    domain_id: column('aggregate', 'domain_id', 'required'),
  },
  handler: moveAggregate,
} satisfies CommandDefinition<MoveAggregate>;

// Renamed under the new domain first, then carryUseCasesWith brings along each use case with one of its commands as its result.
export function moveAggregate(tx: Transaction, input: MoveAggregate): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.load(input.id) ?? tx.refuse('missing', `there is no aggregate ${input.id}`);
  const entities = new Set(aggregate.entities.map((e) => e.row.id));
  const commands = tx.rows('command').filter((c) => entities.has(String(c.entity_id))).map((c) => String(c.id));
  const renames = toDomain(tx, { id: input.id, label: 'aggregate', domainId: aggregate.aggregate.domain_id }, input.domain_id);
  aggregate.aggregate = { ...aggregate.aggregate, domain_id: input.domain_id };
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
  aggregates.carryRenames(renames);
  carryUseCasesWith(tx, commands.map((id) => renames.get(id) ?? id), input.domain_id);
}
