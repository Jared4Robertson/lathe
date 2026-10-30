import type { KeymapEntry } from './read-model';
import type { KeymapReader } from './reader';

/** List the commands (LA-PLT-QRY03): every keyboard command with the keys that run it here, its defaults and whether they changed. */
export function listKeyboardCommands(reader: KeymapReader): KeymapEntry[] {
  return reader.commands();
}
