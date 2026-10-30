// The Endpoint aggregate's commands as the app sends them (LA-AUT-A13): each route, POST /api/endpoint/<command>, with
// its input, the type its command file declares. The endpoint's editor sends only these, one command per change; a test
// holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddApiRequirement } from '../../../../lathe/src/authoring/endpoint/commands/add-api-requirement';
import type { AddEndpoint } from '../../../../lathe/src/authoring/endpoint/commands/add-endpoint';
import type { AddEndpointHandler } from '../../../../lathe/src/authoring/endpoint/commands/add-endpoint-handler';
import type { AddEndpointTest } from '../../../../lathe/src/authoring/endpoint/commands/add-endpoint-test';
import type { ChangeApiRequirement } from '../../../../lathe/src/authoring/endpoint/commands/change-api-requirement';
import type { ChangeEndpoint } from '../../../../lathe/src/authoring/endpoint/commands/change-endpoint';
import type { ChangeEndpointHandler } from '../../../../lathe/src/authoring/endpoint/commands/change-endpoint-handler';
import type { ChangeEndpointTest } from '../../../../lathe/src/authoring/endpoint/commands/change-endpoint-test';
import type { MoveEndpoint } from '../../../../lathe/src/authoring/endpoint/commands/move-endpoint';
import type { RemoveApiRequirement } from '../../../../lathe/src/authoring/endpoint/commands/remove-api-requirement';
import type { RemoveEndpoint } from '../../../../lathe/src/authoring/endpoint/commands/remove-endpoint';
import type { RemoveEndpointHandler } from '../../../../lathe/src/authoring/endpoint/commands/remove-endpoint-handler';
import type { RemoveEndpointTest } from '../../../../lathe/src/authoring/endpoint/commands/remove-endpoint-test';

/** Each command's route, with its input. */
export interface EndpointCommands {
  '/api/endpoint/add-endpoint': AddEndpoint;
  '/api/endpoint/change-endpoint': ChangeEndpoint;
  '/api/endpoint/move-endpoint': MoveEndpoint;
  '/api/endpoint/remove-endpoint': RemoveEndpoint;
  '/api/endpoint/add-api-requirement': AddApiRequirement;
  '/api/endpoint/change-api-requirement': ChangeApiRequirement;
  '/api/endpoint/remove-api-requirement': RemoveApiRequirement;
  '/api/endpoint/add-endpoint-handler': AddEndpointHandler;
  '/api/endpoint/change-endpoint-handler': ChangeEndpointHandler;
  '/api/endpoint/remove-endpoint-handler': RemoveEndpointHandler;
  '/api/endpoint/add-endpoint-test': AddEndpointTest;
  '/api/endpoint/change-endpoint-test': ChangeEndpointTest;
  '/api/endpoint/remove-endpoint-test': RemoveEndpointTest;
}

export type EndpointRoute = keyof EndpointCommands;

/** Sends one Endpoint command through the shell's writer: its route and its input, typed by the route. */
export const sendEndpoint = <R extends EndpointRoute>(writer: Writer, route: R, input: EndpointCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
