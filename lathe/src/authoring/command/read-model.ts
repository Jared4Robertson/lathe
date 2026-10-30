// The Command aggregate's read model (LA-AUT-RM28), shaped for its readers: the Command page reads a command whole (the
// events it raises, the specifications it checks and the domain services it calls; its handler; its policies, each
// with the event it hears, its event handler and its test; the endpoints that expose it; the other aggregates it also
// changes, each with its reason) with the record the page is
// about, an entity's list reads each command's ID and title, and the editor's next ID reads the IDs in use. The
// projection (commandTableFrom) is the only code that reads the source rows and the only code that writes the read
// model's table; the query handlers read that table only through the reader (reader.ts). Nothing here is the
// aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { CommandChangeRow, CommandHandlerRow, CommandRow, EventHandlerRow, PolicyRow, PolicyTestRow } from '../../platform/data/tables.ts';
import type { CommandKind } from './model.ts';

/** A handler as the page shows it: its row, the standard rules it meets and the packages it uses. */
export interface HandlerOnPage<T> {
  handler: T;
  meets: string[];
  packages: string[];
}

/** A policy test as the page shows it: its row and the test data sets it starts from. */
export interface PolicyTestOnPage {
  test: PolicyTestRow;
  startsFrom: string[];
}

/** A policy as the page shows it: its row, the event it hears, its event handler and its test. */
export interface PolicyOnPage {
  policy: PolicyRow;
  hears: string | null;
  eventHandler: HandlerOnPage<EventHandlerRow> | null;
  test: PolicyTestOnPage | null;
}

/** A command whole, as its page shows it. */
export interface CommandTree {
  command: CommandRow;
  /** The events of its aggregate it raises, by ID. */
  raises: string[];
  /** The specifications of its domain it checks, by ID. */
  checks: string[];
  /** The domain services of its domain it calls, by ID. */
  calls: string[];
  handler: HandlerOnPage<CommandHandlerRow> | null;
  /** The policies that send it, by ID. */
  policies: PolicyOnPage[];
  /** The endpoints that expose it (the Endpoint aggregate's roots), by ID. */
  endpoints: string[];
  /** The other aggregates it also changes in its transaction, each with its reason (its recorded exceptions), by aggregate. */
  alsoChanges: { aggregate: string; reason: string }[];
}

/** A command as its page reads it, with the record of it the page is about. */
export interface CommandPage extends CommandTree {
  record: { id: string; kind: CommandKind };
}

/** A command as an entity's list reads it. */
export interface CommandSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface CommandTable {
  /** Each command whole, by its ID. */
  commands: Map<string, CommandTree>;
  /** Each record inside a command: the command that holds it and its kind there. */
  holding: Map<string, { root: string; kind: CommandKind }>;
  /** Each entity's commands, by ID, and the domain it sits in; an entity with none has an empty list. */
  entities: Map<string, { domain: string; commands: CommandSummary[] }>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

const byId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's targets by source, each list sorted. */
function linked(view: ReadView, table: string, by = 'source_id', to = 'target_id'): (id: string) => string[] {
  const found = grouped<Row>(view.rows(table), by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[to])).sort(byId);
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function commandTableFrom(view: ReadView): CommandTable {
  const [raises, checks, calls, hears, meets, startsFrom] = ['raises', 'checks', 'calls', 'hears', 'meets', 'starts_from'].map((t) => linked(view, t));
  const packages = linked(view, 'package_use', 'record_id', 'package');
  const handlers = grouped<CommandHandlerRow>(view.rows('command_handler'), 'command_id');
  const policies = grouped<PolicyRow>(view.rows('policy'), 'command_id');
  const eventHandlers = grouped<EventHandlerRow>(view.rows('event_handler'), 'policy_id');
  const tests = grouped<PolicyTestRow>(view.rows('policy_test'), 'policy_id');
  const endpoints = grouped<{ id: string }>(view.rows('endpoint').filter((e) => e.command_id !== undefined), 'command_id');
  const changes = grouped<CommandChangeRow>(view.rows('command_change'), 'command_id');
  const built = <T extends { id: string }>(handler: T | undefined): HandlerOnPage<T> | null => (handler ? { handler, meets: meets(handler.id), packages: packages(handler.id) } : null);

  const domainOfAggregate = new Map(view.rows('aggregate').map((a) => [String(a.id), String(a.domain_id)]));
  const entities = new Map<string, { domain: string; commands: CommandSummary[] }>(
    view.rows('entity').map((e) => [String(e.id), { domain: domainOfAggregate.get(String(e.aggregate_id)) ?? '', commands: [] }]),
  );
  const commands = new Map<string, CommandTree>();
  const holding = new Map<string, { root: string; kind: CommandKind }>();
  for (const command of view.rows('command') as unknown as CommandRow[]) {
    const root = command.id;
    const hold = (id: string, kind: CommandKind) => holding.set(id, { root, kind });
    hold(root, 'command');
    const tree: CommandTree = {
      command,
      raises: raises(root),
      checks: checks(root),
      calls: calls(root),
      handler: built((handlers.get(root) ?? [])[0]),
      policies: [...(policies.get(root) ?? [])].sort((a, b) => byId(a.id, b.id)).map((policy) => {
        const test = (tests.get(policy.id) ?? [])[0];
        return { policy, hears: hears(policy.id)[0] ?? null, eventHandler: built((eventHandlers.get(policy.id) ?? [])[0]), test: test ? { test, startsFrom: startsFrom(test.id) } : null };
      }),
      endpoints: (endpoints.get(root) ?? []).map((e) => e.id).sort(byId),
      alsoChanges: (changes.get(root) ?? []).map((c) => ({ aggregate: c.aggregate_id, reason: c.reason })).sort((a, b) => byId(a.aggregate, b.aggregate)),
    };
    if (tree.handler) hold(tree.handler.handler.id, 'command_handler');
    for (const p of tree.policies) {
      hold(p.policy.id, 'policy');
      if (p.eventHandler) hold(p.eventHandler.handler.id, 'event_handler');
      if (p.test) hold(p.test.test.id, 'policy_test');
    }
    commands.set(root, tree);
    entities.get(command.entity_id)?.commands.push({ id: command.id, title: command.title });
  }
  for (const e of entities.values()) e.commands.sort((a, b) => byId(a.id, b.id));
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { commands, holding, entities, kinds };
}
