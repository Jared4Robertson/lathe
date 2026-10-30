import type { CommandKind } from '../../../../lathe/src/authoring/command/model';
import type { CommandPage } from '../../../../lathe/src/authoring/command/read-model';
import { useRead, type Read } from '../../record/read';

// The Command aggregate's reads as its page makes them (LA-AUT-RM28): a command whole as its page shows it, by the ID
// of any record in it (get-command), and the next free ID for a record of one of its kinds under its parent (next-id).

/** The command that holds the record, as its page reads it: read again whenever the data is (`version`). */
export const useCommand = (id: string, version: unknown): Read<CommandPage> => useRead<CommandPage>('/api/command/get-command', { id }, version);

/** The next free ID for a record of the kind under its parent, as the editor suggests it. */
export const useNextCommandId = (kind: CommandKind, parent: string, version: unknown): Read<string> => useRead<string>('/api/command/next-id', { kind, parent }, version);
