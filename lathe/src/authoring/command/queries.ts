// The Command aggregate's own reads, each answered from its read model (LA-AUT-RM28) through its reader (reader.ts),
// which the query runner gives each handler: a command whole as its page reads it, the commands of an entity, and the
// next free ID for a record of one of its kinds. A handler never sees the data, a repository or the aggregate's model;
// each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { CommandKind } from './model.ts';
import type { CommandPage, CommandSummary } from './read-model.ts';
import { commandReader, type CommandReader } from './reader.ts';
import { GET_COMMAND_IDENTITY, LIST_COMMANDS_IDENTITY, NEXT_COMMAND_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a');

/** The command that holds the record, as its page reads it: the command itself, or its handler, a policy, or a policy's handler or test. */
export function getCommand(reader: CommandReader, input: { id: string }): CommandPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a command or a record in one`);
}

/** GET a command whole (LA-AUT-QRY159). */
export const GET_COMMAND: QueryDefinition<{ id: string }, CommandPage, CommandReader> = {
  ...GET_COMMAND_IDENTITY,
  input: { id: id('The command, or its handler, a policy, or a policy\'s event handler or test.', 'required') },
  reader: commandReader,
  run: getCommand,
  text: commandText,
};

/** The commands under an entity, by ID. */
export function listCommands(reader: CommandReader, input: { entity_id: string }): CommandSummary[] {
  return reader.commandsOf(input.entity_id) ?? refuse('missing', `there is no entity ${input.entity_id}`);
}

/** List the commands of an entity (LA-AUT-QRY160). */
export const LIST_COMMANDS: QueryDefinition<{ entity_id: string }, CommandSummary[], CommandReader> = {
  ...LIST_COMMANDS_IDENTITY,
  input: { entity_id: id('The entity.', 'required') },
  reader: commandReader,
  run: listCommands,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No commands.'),
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['command', 'command_handler', 'policy', 'event_handler', 'policy_test'];

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a command's and a policy's are their
 * domain's ID, CMD or PO and one past the highest number in use; a command has one handler and a policy one event
 * handler and one test, whose IDs are their parent's with H and T.
 */
export function nextCommandId(reader: CommandReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Command aggregate; its kinds are ${KINDS.join(', ')}`);
  const kind = input.kind as CommandKind;
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== shape.parents[0]) refuse('parent', `${article(kind)} ${kind} sits under ${article(shape.parents[0])} ${shape.parents[0]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  const only = (id: string) => {
    if (reader.kindOf(id)) refuse('exists', `${input.parent} already has its ${kind.replace('_', ' ')}, ${id}`);
    return id;
  };
  switch (kind) {
    case 'command':
      return onePast(reader, `${reader.domainOf(input.parent)}-${shape.letters}`, shape);
    case 'policy':
      return onePast(reader, `${reader.domainOf(input.parent)}-${shape.letters}`, shape);
    case 'command_handler':
    case 'event_handler':
      return only(`${input.parent}-${shape.letters}`);
    case 'policy_test':
      return only(`${input.parent}-${shape.letters}`);
  }
}

/** Get the next ID for a record of the Command aggregate (LA-AUT-QRY161). */
export const NEXT_COMMAND_ID: QueryDefinition<{ kind: string; parent: string }, string, CommandReader> = {
  ...NEXT_COMMAND_ID_IDENTITY,
  input: {
    kind: id('The kind: command, command_handler, policy, event_handler or policy_test.', 'required'),
    parent: id('The record it will sit under.', 'required'),
  },
  reader: commandReader,
  run: nextCommandId,
  text: (next) => next,
};

/** A command as text: its row and links, its handler, then each policy with what is under it, then its endpoints. */
function commandText(page: CommandPage): string {
  const { command: row } = page;
  const lines = [`Command ${row.id}: ${row.title}`, `  entity: ${row.entity_id}`, `  description: ${row.description}`];
  const links = [...page.raises.map((x) => `raises ${x}`), ...page.checks.map((x) => `checks ${x}`), ...page.calls.map((x) => `calls ${x}`)];
  if (links.length) lines.push(`  ${links.join('; ')}`);
  const built = (b: { handler: { file?: string }; meets: string[]; packages: string[] }) => {
    const extra = [...(b.handler.file ? [b.handler.file] : []), ...b.meets.map((x) => `meets ${x}`), ...b.packages.map((x) => `uses ${x}`)];
    return extra.length ? ` [${extra.join('; ')}]` : '';
  };
  if (page.handler) lines.push(`Command handler ${page.handler.handler.id}: ${page.handler.handler.title}${built(page.handler)}`);
  for (const p of page.policies) {
    lines.push(`Policy ${p.policy.id}: ${p.policy.title}${p.hears ? ` [hears ${p.hears}]` : ''}`);
    if (p.eventHandler) lines.push(`  event handler ${p.eventHandler.handler.id}: ${p.eventHandler.handler.title}${built(p.eventHandler)}`);
    if (p.test) lines.push(`  policy test ${p.test.test.id}: ${p.test.test.title} (${p.test.test.state})`);
  }
  for (const e of page.endpoints) lines.push(`Endpoint ${e}`);
  return lines.join('\n');
}
