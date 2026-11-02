// Generated from data/ by `npm run generate`. Do not edit.
// The command commands whose handler is the pattern: load the command, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules, oneCommandHandler } from '../rules.ts';
import type { AddCommand } from './add-command.ts';
import type { ChangeCommand } from './change-command.ts';
import type { RemoveCommand } from './remove-command.ts';
import type { AddCommandHandler } from './add-command-handler.ts';
import type { ChangeCommandHandler } from './change-command-handler.ts';
import type { RemoveCommandHandler } from './remove-command-handler.ts';
import type { AddPolicy } from './add-policy.ts';
import type { ChangePolicy } from './change-policy.ts';
import type { RemovePolicy } from './remove-policy.ts';
import type { AddEventHandler } from './add-event-handler.ts';
import type { ChangeEventHandler } from './change-event-handler.ts';
import type { RemoveEventHandler } from './remove-event-handler.ts';
import type { AddPolicyTest } from './add-policy-test.ts';
import type { ChangePolicyTest } from './change-policy-test.ts';
import type { RemovePolicyTest } from './remove-policy-test.ts';

/** Adds a command under the entity it changes, with the events of its aggregate it raises, the specifications it checks and the domain services it calls. */
export function addCommand(tx: Transaction, input: AddCommand): void {
  const commands = new CommandRepository(tx);
  if (tx.record(input.entity_id)?.kind !== 'entity') tx.refuse('missing', `there is no entity ${input.entity_id}`);
  const { raises = [], checks = [], calls = [], ...row } = input;
  const command = commands.create({ root: row.id, command: row, raises: raises, checks: checks, calls: calls, handler: null, policies: [], eventHandlers: [], policyTests: [] });
  holdToRules(tx, command);
  commands.save(command);
}

/** Changes a command's title or description, or the events it raises, the specifications it checks or the domain services it calls (each list whole). The entity it changes does not change. */
export function changeCommand(tx: Transaction, input: ChangeCommand): void {
  const commands = new CommandRepository(tx);
  const command = commands.load(input.id) ?? tx.refuse('missing', `there is no command ${input.id}`);
  command.command = changed(command.command, input, ['title', 'description']);
  command.raises = input.raises ?? command.raises;
  command.checks = input.checks ?? command.checks;
  command.calls = input.calls ?? command.calls;
  holdToRules(tx, command);
  commands.save(command);
}

/** Removes a command whole: its handler, its policies with their event handlers and tests, and the links they start. Refused while anything outside it references what is in it: a step that invokes it, its endpoint or command-line command. */
export function removeCommand(tx: Transaction, input: RemoveCommand): void {
  const commands = new CommandRepository(tx);
  const command = commands.load(input.id) ?? tx.refuse('missing', `there is no command ${input.id}`);
  commands.remove(command);
}

/** Adds the handler that carries out a command: its name in code, its file and what it does, with the standard rules it meets and the packages it uses. A command has one handler. */
export function addCommandHandler(tx: Transaction, input: AddCommandHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.load(input.command_id) ?? tx.refuse('missing', `there is no command ${input.command_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(oneCommandHandler([...(command.handler ? [command.handler.row] : []), row]));
  command.handler = { row, meets: meets, packages: packages };
  holdToRules(tx, command);
  commands.save(command);
}

/** Changes a command handler's title, file or description, or the standard rules it meets or the packages it uses (each list whole). Its command does not change. */
export function changeCommandHandler(tx: Transaction, input: ChangeCommandHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('command_handler', input.id) ?? tx.refuse('missing', `there is no command handler ${input.id}`);
  const held = command.handler!;
  command.handler = { row: changed(held.row, input, ['title', 'file', 'description']), meets: input.meets ?? held.meets, packages: input.packages ?? held.packages };
  holdToRules(tx, command);
  commands.save(command);
}

/** Removes a command handler with the links it starts and the packages it uses. Refused while anything else references it. */
export function removeCommandHandler(tx: Transaction, input: RemoveCommandHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('command_handler', input.id) ?? tx.refuse('missing', `there is no command handler ${input.id}`);
  command.handler = null;
  commands.save(command);
}

/** Adds a policy under the command it sends, with the one event it hears (its own domain's, or another domain's published one) and the integrations it exchanges with as it acts. */
export function addPolicy(tx: Transaction, input: AddPolicy): void {
  const commands = new CommandRepository(tx);
  const command = commands.load(input.command_id) ?? tx.refuse('missing', `there is no command ${input.command_id}`);
  const { hears, exchanges_with = [], ...row } = input;
  command.policies.push({ row, exchangesWith: exchanges_with, hears: hears ?? null });
  holdToRules(tx, command);
  commands.save(command);
}

/** Changes a policy's title or statement, the event it hears or the integrations it exchanges with (the whole list); null clears the event. The command it sends does not change. */
export function changePolicy(tx: Transaction, input: ChangePolicy): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy', input.id) ?? tx.refuse('missing', `there is no policy ${input.id}`);
  command.policies = command.policies.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'statement']), exchangesWith: input.exchanges_with ?? x.exchangesWith, hears: input.hears === undefined ? x.hears : input.hears } : x));
  holdToRules(tx, command);
  commands.save(command);
}

/** Removes a policy with its event handler and test and the links they start. Refused while anything else references them. */
export function removePolicy(tx: Transaction, input: RemovePolicy): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy', input.id) ?? tx.refuse('missing', `there is no policy ${input.id}`);
  command.policies = command.policies.filter((x) => x.row.id !== input.id);
  command.eventHandlers = command.eventHandlers.filter((x) => x.row.policy_id !== input.id);
  command.policyTests = command.policyTests.filter((x) => x.row.policy_id !== input.id);
  commands.save(command);
}

/** Adds the handler that carries out a policy: its name in code, its file and what it does, with the standard rules it meets and the packages it uses. A policy has one event handler. */
export function addEventHandler(tx: Transaction, input: AddEventHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy', input.policy_id) ?? tx.refuse('missing', `there is no policy ${input.policy_id}`);
  const { meets = [], packages = [], ...row } = input;
  command.eventHandlers.push({ row, meets: meets, packages: packages });
  holdToRules(tx, command);
  commands.save(command);
}

/** Changes an event handler's title, file or description, or the standard rules it meets or the packages it uses (each list whole). Its policy does not change. */
export function changeEventHandler(tx: Transaction, input: ChangeEventHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('event_handler', input.id) ?? tx.refuse('missing', `there is no event handler ${input.id}`);
  command.eventHandlers = command.eventHandlers.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'file', 'description']), meets: input.meets ?? x.meets, packages: input.packages ?? x.packages } : x));
  holdToRules(tx, command);
  commands.save(command);
}

/** Removes an event handler with the links it starts and the packages it uses. Refused while anything else references it. */
export function removeEventHandler(tx: Transaction, input: RemoveEventHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('event_handler', input.id) ?? tx.refuse('missing', `there is no event handler ${input.id}`);
  command.eventHandlers = command.eventHandlers.filter((x) => x.row.id !== input.id);
  commands.save(command);
}

/** Adds the test of a policy, with the test data sets it starts from. */
export function addPolicyTest(tx: Transaction, input: AddPolicyTest): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy', input.policy_id) ?? tx.refuse('missing', `there is no policy ${input.policy_id}`);
  const { starts_from = [], ...row } = input;
  command.policyTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, command);
  commands.save(command);
}

/** Changes a policy test's way of running or the test data sets it starts from (the whole list). */
export function changePolicyTest(tx: Transaction, input: ChangePolicyTest): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy_test', input.id) ?? tx.refuse('missing', `there is no policy test ${input.id}`);
  command.policyTests = command.policyTests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  holdToRules(tx, command);
  commands.save(command);
}

/** Removes a policy test with the links it starts. Refused while anything else references it, such as a business outcome it measures. */
export function removePolicyTest(tx: Transaction, input: RemovePolicyTest): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy_test', input.id) ?? tx.refuse('missing', `there is no policy test ${input.id}`);
  command.policyTests = command.policyTests.filter((x) => x.row.id !== input.id);
  commands.save(command);
}
