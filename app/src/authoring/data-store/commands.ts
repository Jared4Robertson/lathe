// The Data store aggregate's commands as the app sends them (LA-AUT-A23): each route, POST /api/data-store/<command>, with its
// input, the type its command file declares. The data store's editor sends only these, one command per change; a test
// holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddDataStore } from '../../../../lathe/src/authoring/data-store/commands/add-data-store';
import type { ChangeDataStore } from '../../../../lathe/src/authoring/data-store/commands/change-data-store';
import type { RemoveDataStore } from '../../../../lathe/src/authoring/data-store/commands/remove-data-store';

/** Each command's route, with its input. */
export interface DataStoreCommands {
  '/api/data-store/add-data-store': AddDataStore;
  '/api/data-store/change-data-store': ChangeDataStore;
  '/api/data-store/remove-data-store': RemoveDataStore;
}

export type DataStoreRoute = keyof DataStoreCommands;

/** Sends one Data store command through the shell's writer: its route and its input, typed by the route. */
export const sendDataStore = <R extends DataStoreRoute>(writer: Writer, route: R, input: DataStoreCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
