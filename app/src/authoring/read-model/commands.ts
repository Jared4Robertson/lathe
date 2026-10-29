// The Read model aggregate's commands as the app sends them (LA-AUT-A10): each route, POST /api/read-model/<command>, with
// its input, the type its command file declares. Its editor sends only these, one command per change; a test holds
// this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddProjection } from '../../../../lathe/src/authoring/read-model/commands/add-projection';
import type { AddQuery } from '../../../../lathe/src/authoring/read-model/commands/add-query';
import type { AddQueryHandler } from '../../../../lathe/src/authoring/read-model/commands/add-query-handler';
import type { AddReadModel } from '../../../../lathe/src/authoring/read-model/commands/add-read-model';
import type { AddReader } from '../../../../lathe/src/authoring/read-model/commands/add-reader';
import type { ChangeProjection } from '../../../../lathe/src/authoring/read-model/commands/change-projection';
import type { ChangeQuery } from '../../../../lathe/src/authoring/read-model/commands/change-query';
import type { ChangeQueryHandler } from '../../../../lathe/src/authoring/read-model/commands/change-query-handler';
import type { ChangeReadModel } from '../../../../lathe/src/authoring/read-model/commands/change-read-model';
import type { ChangeReader } from '../../../../lathe/src/authoring/read-model/commands/change-reader';
import type { RemoveProjection } from '../../../../lathe/src/authoring/read-model/commands/remove-projection';
import type { RemoveQuery } from '../../../../lathe/src/authoring/read-model/commands/remove-query';
import type { RemoveQueryHandler } from '../../../../lathe/src/authoring/read-model/commands/remove-query-handler';
import type { RemoveReadModel } from '../../../../lathe/src/authoring/read-model/commands/remove-read-model';
import type { RemoveReader } from '../../../../lathe/src/authoring/read-model/commands/remove-reader';

/** Each command's route, with its input. */
export interface ReadModelCommands {
  '/api/read-model/add-projection': AddProjection;
  '/api/read-model/add-query': AddQuery;
  '/api/read-model/add-query-handler': AddQueryHandler;
  '/api/read-model/add-read-model': AddReadModel;
  '/api/read-model/add-reader': AddReader;
  '/api/read-model/change-projection': ChangeProjection;
  '/api/read-model/change-query': ChangeQuery;
  '/api/read-model/change-query-handler': ChangeQueryHandler;
  '/api/read-model/change-read-model': ChangeReadModel;
  '/api/read-model/change-reader': ChangeReader;
  '/api/read-model/remove-projection': RemoveProjection;
  '/api/read-model/remove-query': RemoveQuery;
  '/api/read-model/remove-query-handler': RemoveQueryHandler;
  '/api/read-model/remove-read-model': RemoveReadModel;
  '/api/read-model/remove-reader': RemoveReader;
}

export type ReadModelRoute = keyof ReadModelCommands;

/** Sends one command through the shell's writer: its route and its input, typed by the route. */
export const sendReadModel = <R extends ReadModelRoute>(writer: Writer, route: R, input: ReadModelCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
