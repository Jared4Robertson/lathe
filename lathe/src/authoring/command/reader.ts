// The Command read model's reader (LA-AUT-RM28-RD): the one way the Command queries reach the read model's storage.
// The query handlers depend only on the CommandReader interface; the query runner injects the reader each query's
// definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and
// nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { commandTableFrom, type CommandPage, type CommandSummary, type CommandTable } from './read-model.ts';

/** What the Command queries read, and all they read. */
export interface CommandReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside a command, or undefined when no command holds it. */
  page(id: string): CommandPage | undefined;
  /** An entity's commands, by ID, or undefined when there is no such entity. */
  commandsOf(entityId: string): CommandSummary[] | undefined;
  /** The domain an entity, or a command through its entity, sits in; undefined when there is no such record. */
  domainOf(id: string): string | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryCommandReader implements CommandReader {
  private readonly table: CommandTable;

  constructor(table: CommandTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): CommandPage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.commands.get(holding.root)! };
  }

  commandsOf(entityId: string): CommandSummary[] | undefined {
    return this.table.entities.get(entityId)?.commands;
  }

  domainOf(id: string): string | undefined {
    const entity = this.table.commands.get(id)?.command.entity_id ?? id;
    return this.table.entities.get(entity)?.domain;
  }

  highestAfter(prefix: string): number {
    const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
    let highest = 0;
    for (const id of this.table.kinds.keys()) {
      const m = shape.exec(id);
      if (m) highest = Math.max(highest, Number(m[1]));
    }
    return highest;
  }
}

/** The reader the query runner gives each Command query: today's, over the projection's table built from the data. */
export const commandReader = (view: ReadView): CommandReader => new InMemoryCommandReader(commandTableFrom(view));
