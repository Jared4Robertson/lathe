// The Command aggregate's rules, written once: each command's handler runs them on the instance before it saves, and
// every load and commit runs them over all data (commandRules, listed in AGGREGATE_RULES).
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { COMMAND_AGGREGATE, commandsFrom, type CommandInstance } from './model.ts';

// The domain of the aggregate with this ID, read from the view, or undefined.
function domainOfAggregate(view: ReadView, aggregateId: unknown): string | undefined {
  const aggregate = view.record(String(aggregateId));
  return aggregate?.kind === 'aggregate' ? String(aggregate.row.domain_id) : undefined;
}

/**
 * Every rule the command breaks (LA-AUT-INV70 a policy hears its own domain's events, or another domain's published
 * ones). The view gives what the command names outside itself: its entity's aggregate and the events its policies hear.
 */
export function commandProblems(command: CommandInstance, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const entity = view.record(command.command.entity_id);
  const own = entity?.kind === 'entity' ? domainOfAggregate(view, entity.row.aggregate_id) : undefined;
  for (const policy of command.policies) {
    if (policy.hears === null) continue;
    const event = view.record(policy.hears);
    if (event?.kind !== 'domain_event' || event.row.published) continue;
    const other = domainOfAggregate(view, event.row.aggregate_id);
    if (other === own) continue;
    problems.push({
      rule: 'policy-hears-published',
      table: 'hears',
      row: { source_id: policy.row.id, target_id: policy.hears },
      message: `${policy.row.id} is a policy of domain ${own ?? 'none'}, so it cannot hear ${policy.hears}, an event of domain ${other ?? 'none'} that is not published`,
    });
  }
  return problems;
}

/** The rules over all data: every command, whole. */
export const commandRules: AggregateRules = {
  aggregate: COMMAND_AGGREGATE,
  check: (view) => commandsFrom((table) => view.rows(table)).flatMap((command) => commandProblems(command, view)),
};

/** Refuses the command, with every reason, when the command as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, command: CommandInstance): void {
  const problems = commandProblems(command, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
