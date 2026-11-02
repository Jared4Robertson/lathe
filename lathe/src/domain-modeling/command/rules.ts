// The Command aggregate's rules, written once: each command's handler runs them on the instance before it saves, and
// every load and commit runs them over all data (commandRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type ReadView, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { CommandHandlerRow, EventHandlerRow, PolicyTestRow } from '../../platform/data/tables.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { COMMAND_AGGREGATE, commandsFrom, type Command } from './model.ts';

// The domain of the aggregate with this ID, read from the view, or undefined.
function domainOfAggregate(view: ReadView, aggregateId: unknown): string | undefined {
  const aggregate = view.record(String(aggregateId));
  return aggregate?.kind === 'aggregate' ? String(aggregate.row.domain_id) : undefined;
}

/** A policy's hears link, as its row. */
interface HearsRow {
  source_id: string;
  target_id: string;
}

// One row past the first of its parent, refused as LA-MOD-INV104's.
const second = (table: string, what: string, parent: string) => (row: object, id: string, of: string): RuleProblem => ({
  rule: 'command-one-each',
  table,
  row: row as unknown as Row,
  message: `${parent} ${of} already has its ${what}, so ${id} cannot be a second: a ${parent} has one`,
});

/** Every command handler after the first of its command (LA-MOD-INV104). */
export function oneCommandHandler(handlers: readonly CommandHandlerRow[]): RuleProblem[] {
  return beyondFirst(handlers, (r) => r.command_id).map((r) => second('command_handler', 'command handler', 'command')(r, r.id, r.command_id));
}

/**
 * Every row that breaks LA-MOD-INV104: a command has at most one command handler, and a policy hears at most one event
 * and has at most one event handler and one policy test. Each after the first of its parent is refused; a policy that
 * hears nothing is a gap (policy-hears-nothing), not a refusal.
 */
export function commandOneEach(handlers: readonly CommandHandlerRow[], hears: readonly HearsRow[], eventHandlers: readonly EventHandlerRow[], policyTests: readonly PolicyTestRow[]): RuleProblem[] {
  return [
    ...oneCommandHandler(handlers),
    ...beyondFirst(hears, (r) => r.source_id).map((r) => second('hears', 'event', 'policy')(r, r.target_id, r.source_id)),
    ...beyondFirst(eventHandlers, (r) => r.policy_id).map((r) => second('event_handler', 'event handler', 'policy')(r, r.id, r.policy_id)),
    ...beyondFirst(policyTests, (r) => r.policy_id).map((r) => second('policy_test', 'test', 'policy')(r, r.id, r.policy_id)),
  ];
}

/**
 * Every rule the command breaks (LA-MOD-INV104 one each, as commandOneEach says; LA-MOD-INV70 a policy hears its own
 * domain's events, or another domain's published ones). The view gives what the command names outside itself: its
 * entity's aggregate and the events its policies hear.
 */
export function commandProblems(command: Command, view: ReadView): RuleProblem[] {
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
  problems.push(
    ...commandOneEach(
      command.handler ? [command.handler.row] : [],
      command.policies.flatMap((p) => (p.hears === null ? [] : [{ source_id: p.row.id, target_id: p.hears }])),
      command.eventHandlers.map((h) => h.row),
      command.policyTests.map((t) => t.row),
    ),
  );
  return problems;
}

/** The rules over all data: every command, whole. */
export const commandRules: AggregateRules = {
  aggregate: COMMAND_AGGREGATE,
  check: (view) => [
    ...commandsFrom((table) => view.rows(table)).flatMap((command) => commandProblems(command, view).filter((p) => p.rule !== 'command-one-each')),
    ...commandOneEach(
      view.rows('command_handler') as unknown as CommandHandlerRow[],
      view.rows('hears') as unknown as HearsRow[],
      view.rows('event_handler') as unknown as EventHandlerRow[],
      view.rows('policy_test') as unknown as PolicyTestRow[],
    ),
  ],
};

/** Refuses the command, with every reason, when the command as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, command: Command): void {
  const problems = commandProblems(command, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message })));
}
