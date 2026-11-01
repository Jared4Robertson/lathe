// The Command aggregate (LA-AUT-A8): a command with the events it raises, the specifications it checks and the
// domain services it calls, its handler, and the policies that send it, each with the event it hears, its event
// handler and its test. One instance is one command, whole; it holds only the links its own records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { CommandHandlerRow, CommandRow, EventHandlerRow, PolicyRow, PolicyTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const COMMAND_AGGREGATE = 'LA-AUT-A8';

/** A technical record with the standard rules it meets and the packages it uses. */
export interface Built<T> {
  row: T;
  meets: string[];
  packages: string[];
}

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** A policy with the one event it hears, once it hears one. */
export interface Policy {
  row: PolicyRow;
  hears: string | null;
}

/** One command, whole. */
export interface Command {
  /** The command's ID: the instance's root. */
  readonly root: string;
  command: CommandRow;
  /** The events of its aggregate it raises. */
  raises: string[];
  /** The specifications of its domain it checks before it acts. */
  checks: string[];
  /** The domain services of its domain it calls. */
  calls: string[];
  /** Its handler, when it has one: a command has at most one. */
  handler: Built<CommandHandlerRow> | null;
  policies: Policy[];
  eventHandlers: Built<EventHandlerRow>[];
  policyTests: Tested<PolicyTestRow>[];
}

/** The tables the Command aggregate keeps its rows in: its kinds and the relations its records start. */
export const COMMAND_TABLES = [
  'command',
  'command_handler',
  'policy',
  'event_handler',
  'policy_test',
  'raises',
  'checks',
  'calls',
  'hears',
  'meets',
  'package_use',
  'starts_from',
] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const COMMAND_SHAPE = {
  command: { at: 'command', lists: { raises: 'raises', checks: 'checks', calls: 'calls' } },
  command_handler: { at: 'handler', one: true, refusedBy: 'oneCommandHandler', lists: { meets: 'meets', packages: 'packages' } },
  policy: { at: 'policies', links: { hears: 'hears' } },
  event_handler: { at: 'eventHandlers', lists: { meets: 'meets', packages: 'packages' } },
  policy_test: { at: 'policyTests', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

export type CommandKind = keyof typeof COMMAND_SHAPE;

/** The commands in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function commandsFrom(rows: (table: string) => Row[], only?: string): Command[] {
  const commands = rows('command').filter((r) => only === undefined || r.id === only) as unknown as CommandRow[];
  if (!commands.length) return [];
  const ids = new Set(commands.map((c) => c.id));
  const handlers = (rows('command_handler') as unknown as CommandHandlerRow[]).filter((h) => ids.has(h.command_id));
  const policies = (rows('policy') as unknown as PolicyRow[]).filter((p) => ids.has(p.command_id));
  const policyIds = new Set(policies.map((p) => p.id));
  const commandOf = new Map(policies.map((p) => [p.id, p.command_id]));
  const handlersOf = groupBy(handlers, (h) => h.command_id);
  const policiesOf = groupBy(policies, (p) => p.command_id);
  const eventHandlersOf = groupBy((rows('event_handler') as unknown as EventHandlerRow[]).filter((h) => policyIds.has(h.policy_id)), (h) => commandOf.get(h.policy_id));
  const policyTestsOf = groupBy((rows('policy_test') as unknown as PolicyTestRow[]).filter((t) => policyIds.has(t.policy_id)), (t) => commandOf.get(t.policy_id));
  const [raises, checks, calls, hears, meets, startsFrom] = ['raises', 'checks', 'calls', 'hears', 'meets', 'starts_from'].map((table) => bySource(rows(table)));
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  const built = <T extends { id: string }>(row: T): Built<T> => ({ row, meets: groupOf(meets, row.id), packages: groupOf(packages, row.id) });
  return commands.map((command) => {
    const handler = groupOf(handlersOf, command.id)[0];
    return {
      root: command.id,
      command,
      raises: groupOf(raises, command.id),
      checks: groupOf(checks, command.id),
      calls: groupOf(calls, command.id),
      handler: handler ? built(handler) : null,
      policies: groupOf(policiesOf, command.id).map((row) => ({ row, hears: groupOf(hears, row.id)[0] ?? null })),
      eventHandlers: groupOf(eventHandlersOf, command.id).map(built),
      policyTests: groupOf(policyTestsOf, command.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
    };
  });
}

const links = (source: string, ids: (string | null)[]): Row[] => ids.filter((id): id is string => id !== null).map((target) => ({ source_id: source, target_id: target }));

/** The instance's rows, by table. */
export function commandRows(command: Command): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  const built = [...(command.handler ? [command.handler] : []), ...command.eventHandlers];
  return new Map<string, Row[]>([
    ['command', [asRow(command.command)]],
    ['command_handler', command.handler ? [asRow(command.handler.row)] : []],
    ['policy', command.policies.map((p) => asRow(p.row))],
    ['event_handler', command.eventHandlers.map((h) => asRow(h.row))],
    ['policy_test', command.policyTests.map((t) => asRow(t.row))],
    ['raises', links(command.root, command.raises)],
    ['checks', links(command.root, command.checks)],
    ['calls', links(command.root, command.calls)],
    ['hears', command.policies.flatMap((p) => links(p.row.id, [p.hears]))],
    ['meets', built.flatMap((b) => links(b.row.id, b.meets))],
    ['package_use', built.flatMap((b) => b.packages.map((p) => ({ record_id: b.row.id, package: p })))],
    ['starts_from', command.policyTests.flatMap((t) => links(t.row.id, t.startsFrom))],
  ]);
}

