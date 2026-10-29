// The Tooling aggregate's commands as the app sends them (LA-AUT-A21): each route, POST /api/tooling/<command>,
// with its input, the type its command file declares. The tooling record's editor sends only these, one command per
// change; a test holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddTooling } from '../../../../lathe/src/authoring/tooling/commands/add-tooling';
import type { ChangeTooling } from '../../../../lathe/src/authoring/tooling/commands/change-tooling';
import type { RemoveTooling } from '../../../../lathe/src/authoring/tooling/commands/remove-tooling';

/** Each command's route, with its input. */
export interface ToolingCommands {
  '/api/tooling/add-tooling': AddTooling;
  '/api/tooling/change-tooling': ChangeTooling;
  '/api/tooling/remove-tooling': RemoveTooling;
}

export type ToolingRoute = keyof ToolingCommands;

/** Sends one Tooling command through the shell's writer: its route and its input, typed by the route. */
export const sendTooling = <R extends ToolingRoute>(writer: Writer, route: R, input: ToolingCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
