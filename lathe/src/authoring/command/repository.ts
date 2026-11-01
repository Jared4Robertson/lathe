// Generated from data/ by `npm run generate`. Do not edit.
// CommandRepository (LA-AUT-REPO08): Loads a command whole from the transaction's draft (the events it raises, the
// specifications it checks and the domain services it calls, its handler, and its policies with the event each hears,
// their event handlers and tests) and saves exactly the rows that changed, in the Command aggregate's own tables only;
// a write to any other table is refused when it is made (`DataFiles`). A record inside one is loaded through the root
// that holds it (`loadHolding`), and a removal is refused, naming the referrers, while anything outside what goes
// references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { COMMAND_TABLES, commandRows, commandsFrom, type Command, type CommandKind } from './model.ts';

export class CommandRepository extends Repository<Command> {
  constructor(tx: Transaction) {
    super(tx, 'CommandRepository', COMMAND_TABLES);
  }

  protected read(rootId: string): Command | undefined {
    return commandsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(command: Command): InstanceRows {
    return commandRows(command);
  }

  /** Loads the command that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: CommandKind, id: string): Command | undefined {
    const root = this.rootOf(kind, id);
    const command = root === undefined ? undefined : this.load(root);
    return command && holds(command, kind, id) ? command : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: CommandKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'command': return id;
      case 'command_handler': return this.rootOf('command', String(row.command_id));
      case 'policy': return this.rootOf('command', String(row.command_id));
      case 'event_handler': return this.rootOf('policy', String(row.policy_id));
      case 'policy_test': return this.rootOf('policy', String(row.policy_id));
    }
  }
}

/** Whether the command holds the record of the kind with this ID. */
function holds(command: Command, kind: CommandKind, id: string): boolean {
  switch (kind) {
    case 'command': return command.root === id;
    case 'command_handler': return command.handler?.row.id === id;
    case 'policy': return command.policies.some((x) => x.row.id === id);
    case 'event_handler': return command.eventHandlers.some((x) => x.row.id === id);
    case 'policy_test': return command.policyTests.some((x) => x.row.id === id);
  }
}
