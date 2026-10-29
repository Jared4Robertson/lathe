// CommandRepository (LA-AUT-REPO08): loads and saves the Command aggregate whole, in its own tables only. A record
// inside a command (its handler, a policy, a policy's event handler or test) is reached through the command that
// holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { COMMAND_KINDS, COMMAND_TABLES, commandRows, commandsFrom, kindInside, type Command, type CommandKind } from './model.ts';

/** The kind each parent column of the aggregate's kinds names. */
const PARENT_KIND = { command_id: 'command', policy_id: 'policy' } as const;

export class CommandRepository extends AggregateRepository<Command> {
  constructor(tx: Transaction) {
    super(tx, 'CommandRepository', COMMAND_TABLES);
  }

  protected read(rootId: string): Command | undefined {
    return commandsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(command: Command): InstanceRows {
    return commandRows(command);
  }

  /**
   * Loads the command that holds the record of the kind with this ID: the command itself, or the command of the
   * handler, policy, event handler or policy test, found up its parents inside the aggregate. Undefined when there is
   * no such record.
   */
  loadHolding(kind: CommandKind, id: string): Command | undefined {
    let at: { kind: CommandKind; id: string } = { kind, id };
    for (;;) {
      const row = this.files.find(at.kind, { id: at.id });
      if (!row) return undefined;
      if (at.kind === 'command') break;
      const column = COMMAND_KINDS[at.kind];
      at = { kind: PARENT_KIND[column], id: String(row[column]) };
    }
    const command = this.load(at.id);
    return command && kindInside(command, id) === kind ? command : undefined;
  }
}
