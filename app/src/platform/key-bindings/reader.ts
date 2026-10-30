import { keymapTableFrom, type KeymapEntry, type KeymapSource, type KeymapTable } from './read-model';

/** The reads the Keymap query needs. */
export interface KeymapReader { commands(): KeymapEntry[] }

class InMemoryKeymapReader implements KeymapReader {
  readonly table: KeymapTable;
  constructor(table: KeymapTable) { this.table = table; }
  commands() { return this.table.commands; }
}

/** The Keymap reader over a table built from the person's Key bindings for the platform the app runs on. */
export const keymapReader = (source: KeymapSource): KeymapReader => new InMemoryKeymapReader(keymapTableFrom(source));
