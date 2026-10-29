// The Entry point aggregate's commands as the app sends them (LA-AUT-A20): each route, POST /api/entry-point/<command>,
// with its input, the type its command file declares. The entry point's editor sends only these, one command per
// change; a test holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddEntryPoint } from '../../../../lathe/src/authoring/entry-point/commands/add-entry-point';
import type { ChangeEntryPoint } from '../../../../lathe/src/authoring/entry-point/commands/change-entry-point';
import type { RemoveEntryPoint } from '../../../../lathe/src/authoring/entry-point/commands/remove-entry-point';

/** Each command's route, with its input. */
export interface EntryPointCommands {
  '/api/entry-point/add-entry-point': AddEntryPoint;
  '/api/entry-point/change-entry-point': ChangeEntryPoint;
  '/api/entry-point/remove-entry-point': RemoveEntryPoint;
}

export type EntryPointRoute = keyof EntryPointCommands;

/** Sends one Entry point command through the shell's writer: its route and its input, typed by the route. */
export const sendEntryPoint = <R extends EntryPointRoute>(writer: Writer, route: R, input: EntryPointCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
