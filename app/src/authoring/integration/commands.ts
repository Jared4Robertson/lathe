// The Integration aggregate's commands as the app sends them (LA-AUT-A14): each route, POST /api/integration/<command>,
// with its input, the type its command file declares. The integration's editor sends only these, one command per
// change; a test holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddAdapter } from '../../../../lathe/src/authoring/integration/commands/add-adapter';
import type { AddIntegration } from '../../../../lathe/src/authoring/integration/commands/add-integration';
import type { AddIntegrationTest } from '../../../../lathe/src/authoring/integration/commands/add-integration-test';
import type { ChangeAdapter } from '../../../../lathe/src/authoring/integration/commands/change-adapter';
import type { ChangeIntegration } from '../../../../lathe/src/authoring/integration/commands/change-integration';
import type { ChangeIntegrationTest } from '../../../../lathe/src/authoring/integration/commands/change-integration-test';
import type { RemoveAdapter } from '../../../../lathe/src/authoring/integration/commands/remove-adapter';
import type { RemoveIntegration } from '../../../../lathe/src/authoring/integration/commands/remove-integration';
import type { RemoveIntegrationTest } from '../../../../lathe/src/authoring/integration/commands/remove-integration-test';

/** Each command's route, with its input. */
export interface IntegrationCommands {
  '/api/integration/add-integration': AddIntegration;
  '/api/integration/change-integration': ChangeIntegration;
  '/api/integration/remove-integration': RemoveIntegration;
  '/api/integration/add-adapter': AddAdapter;
  '/api/integration/change-adapter': ChangeAdapter;
  '/api/integration/remove-adapter': RemoveAdapter;
  '/api/integration/add-integration-test': AddIntegrationTest;
  '/api/integration/change-integration-test': ChangeIntegrationTest;
  '/api/integration/remove-integration-test': RemoveIntegrationTest;
}

export type IntegrationRoute = keyof IntegrationCommands;

/** Sends one Integration command through the shell's writer: its route and its input, typed by the route. */
export const sendIntegration = <R extends IntegrationRoute>(writer: Writer, route: R, input: IntegrationCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
