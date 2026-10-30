import type { Command } from '../../shell/keymap';
import type { KeymapReader } from './reader';

/** List the commands (LA-PLT-QRY03): every keyboard command with the keys that run it here. */
export function listCommands(reader: KeymapReader): Command[] {
  return reader.commands();
}
