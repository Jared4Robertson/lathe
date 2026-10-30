// The Table aggregate's commands as the app sends them (LA-AUT-A18): each route, POST /api/table/<command>, with
// its input, the type its command file declares. Its editor sends only these, one command per change; a test holds
// this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddTable } from '../../../../lathe/src/authoring/table/commands/add-table';
import type { ChangeTable } from '../../../../lathe/src/authoring/table/commands/change-table';
import type { MoveTable } from '../../../../lathe/src/authoring/table/commands/move-table';
import type { RemoveTable } from '../../../../lathe/src/authoring/table/commands/remove-table';

/** Each command's route, with its input. */
export interface TableCommands {
  '/api/table/add-table': AddTable;
  '/api/table/change-table': ChangeTable;
  '/api/table/move-table': MoveTable;
  '/api/table/remove-table': RemoveTable;
}

export type TableRoute = keyof TableCommands;

/** Sends one command through the shell's writer: its route and its input, typed by the route. */
export const sendTable = <R extends TableRoute>(writer: Writer, route: R, input: TableCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
