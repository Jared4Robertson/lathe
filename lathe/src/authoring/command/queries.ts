// The Command aggregate's own reads (read model LA-AUT-RM28): a command whole, the commands of an entity, and the
// next free ID for a record of one of its kinds. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { COMMAND_KINDS, COMMAND_SLICE, commandsFrom, type CommandInstance, type CommandKind } from './model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a');

/** The command that holds the record: the command itself, or its handler, a policy, or a policy's handler or test. */
export function getCommand(view: ReadView, input: { id: string }): CommandInstance {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!(record.kind in COMMAND_KINDS)) refuse('kind', `${input.id} is ${article(record.kind)} ${record.kind}, not a command or a record in one`);
  let at = record;
  while (at.kind !== 'command') {
    const column = COMMAND_KINDS[at.kind as Exclude<CommandKind, 'command'>];
    at = view.record(String(at.row[column]))!;
  }
  return commandsFrom((table) => view.rows(table), String(at.row.id))[0];
}

/** GET a command whole (LA-AUT-QRY159). */
export const GET_COMMAND: QueryDefinition<{ id: string }, CommandInstance> = {
  id: 'LA-AUT-QRY159',
  slice: COMMAND_SLICE,
  name: 'get-command',
  description: 'Reads a command whole, by its ID or the ID of any record in it: its row, the events it raises, the specifications it checks and the domain services it calls, its handler, and its policies with the event each hears, their event handlers and tests.',
  input: { id: id('The command, or its handler, a policy, or a policy\'s event handler or test.', 'required') },
  run: getCommand,
  text: commandText,
};

/** The commands under an entity, by ID. */
export function listCommands(view: ReadView, input: { entity_id: string }): { id: string; title: string }[] {
  if (view.record(input.entity_id)?.kind !== 'entity') refuse('missing', `there is no entity ${input.entity_id}`);
  return view
    .rows('command')
    .filter((c) => c.entity_id === input.entity_id)
    .map((c) => ({ id: String(c.id), title: String(c.title) }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** List the commands of an entity (LA-AUT-QRY160). */
export const LIST_COMMANDS: QueryDefinition<{ entity_id: string }, { id: string; title: string }[]> = {
  id: 'LA-AUT-QRY160',
  slice: COMMAND_SLICE,
  name: 'list-commands',
  description: 'Lists the commands that change an entity, by ID, with their titles.',
  input: { entity_id: id('The entity.', 'required') },
  run: listCommands,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No commands.'),
};

// One past the highest number in use after the prefix among the kind's records, padded to two digits.
function onePast(view: ReadView, kind: string, prefix: string): string {
  const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let highest = 0;
  for (const row of view.rows(kind)) {
    const m = shape.exec(String(row.id));
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

// The domain of an entity, or of a command through its entity, by the entity's aggregate.
function domainOf(view: ReadView, record: { kind: string; row: Record<string, unknown> }): string {
  const entity = record.kind === 'entity' ? record : view.record(String(record.row.entity_id))!;
  return String(view.record(String(entity.row.aggregate_id))!.row.domain_id);
}

/** The kinds of the aggregate, each with the kind of record it sits under. */
const UNDER: Record<CommandKind, string> = {
  command: 'entity',
  command_handler: 'command',
  policy: 'command',
  event_handler: 'policy',
  policy_test: 'policy',
};

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a command's and a policy's are their
 * domain's ID, CMD or PO and one past the highest number in use; a command has one handler and a policy one event
 * handler and one test, whose IDs are their parent's with H and T.
 */
export function nextCommandId(view: ReadView, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Command aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as CommandKind;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `${article(kind)} ${kind} sits under ${article(UNDER[kind])} ${UNDER[kind]}, and ${input.parent} is ${parent ? `${article(parent.kind)} ${parent.kind}` : 'no record'}`);
  const only = (id: string) => {
    if (view.record(id)) refuse('exists', `${input.parent} already has its ${kind.replace('_', ' ')}, ${id}`);
    return id;
  };
  switch (kind) {
    case 'command':
      return onePast(view, 'command', `${domainOf(view, parent!)}-CMD`);
    case 'policy':
      return onePast(view, 'policy', `${domainOf(view, parent!)}-PO`);
    case 'command_handler':
    case 'event_handler':
      return only(`${input.parent}-H`);
    case 'policy_test':
      return only(`${input.parent}-T`);
  }
}

/** Get the next ID for a record of the Command aggregate (LA-AUT-QRY161). */
export const NEXT_COMMAND_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
  id: 'LA-AUT-QRY161',
  slice: COMMAND_SLICE,
  name: 'next-id',
  description: 'The next free ID for a command (under an entity), a command handler or policy (under a command), or an event handler or policy test (under a policy): one past the highest in use.',
  input: {
    kind: id('The kind: command, command_handler, policy, event_handler or policy_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  run: nextCommandId,
  text: (next) => next,
};

/** A command as text: its row and links, its handler, then each policy with what is under it. */
function commandText(command: CommandInstance): string {
  const { command: row } = command;
  const lines = [`Command ${row.id}: ${row.title}`, `  entity: ${row.entity_id}`, `  description: ${row.description}`];
  const links = [...command.raises.map((x) => `raises ${x}`), ...command.checks.map((x) => `checks ${x}`), ...command.calls.map((x) => `calls ${x}`)];
  if (links.length) lines.push(`  ${links.join('; ')}`);
  const built = (b: { row: { file?: string }; meets: string[]; packages: string[] }) => {
    const extra = [...(b.row.file ? [b.row.file] : []), ...b.meets.map((x) => `meets ${x}`), ...b.packages.map((x) => `uses ${x}`)];
    return extra.length ? ` [${extra.join('; ')}]` : '';
  };
  if (command.handler) lines.push(`Command handler ${command.handler.row.id}: ${command.handler.row.title}${built(command.handler)}`);
  for (const p of command.policies) {
    lines.push(`Policy ${p.row.id}: ${p.row.title}${p.hears ? ` [hears ${p.hears}]` : ''}`);
    for (const h of command.eventHandlers.filter((x) => x.row.policy_id === p.row.id)) lines.push(`  event handler ${h.row.id}: ${h.row.title}${built(h)}`);
    for (const t of command.policyTests.filter((x) => x.row.policy_id === p.row.id)) lines.push(`  policy test ${t.row.id}: ${t.row.title} (${t.row.state})`);
  }
  return lines.join('\n');
}

/** The Command aggregate's queries, as the CLI and the MCP server register them. */
export const COMMAND_QUERIES: readonly AnyQuery[] = [GET_COMMAND, LIST_COMMANDS, NEXT_COMMAND_ID];
