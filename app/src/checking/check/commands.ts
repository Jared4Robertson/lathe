// The Check aggregate's commands as the app sends them (LA-CHK-A1): each route, POST /api/check/<command>, with its
// input, the type its command file declares. The check's editor sends only these, one command per change; a test holds
// this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddCheck } from '../../../../lathe/src/checking/check/commands/add-check';
import type { ChangeCheck } from '../../../../lathe/src/checking/check/commands/change-check';
import type { RemoveCheck } from '../../../../lathe/src/checking/check/commands/remove-check';

/** Each command's route, with its input. */
export interface CheckCommands {
  '/api/check/add-check': AddCheck;
  '/api/check/change-check': ChangeCheck;
  '/api/check/remove-check': RemoveCheck;
}

export type CheckRoute = keyof CheckCommands;

/** Sends one Check command through the shell's writer: its route and its input, typed by the route. */
export const sendCheck = <R extends CheckRoute>(writer: Writer, route: R, input: CheckCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
