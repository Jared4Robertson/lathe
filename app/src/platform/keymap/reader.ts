import type { Command } from '../../shell/keymap';
import { keymapTableFrom, type KeymapTable } from './read-model';

/** The reads the Keymap query needs. */
export interface KeymapReader { commands(): Command[] }

class InMemoryKeymapReader implements KeymapReader {
  readonly table: KeymapTable;
  constructor(table: KeymapTable) { this.table = table; }
  commands() { return this.table.commands; }
}

/** The Keymap reader over a table built for the platform the app runs on. */
export const keymapReader = (mac: boolean): KeymapReader => new InMemoryKeymapReader(keymapTableFrom(mac));
