// The Business outcome aggregate's commands as the app sends them (LA-AUT-A16): each route, POST
// /api/business-outcome/<command>, with its input, the type its command file declares. The outcome's editor sends only
// these, one command per change; a test holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddBusinessOutcome } from '../../../../lathe/src/authoring/business-outcome/commands/add-business-outcome';
import type { ChangeBusinessOutcome } from '../../../../lathe/src/authoring/business-outcome/commands/change-business-outcome';
import type { RemoveBusinessOutcome } from '../../../../lathe/src/authoring/business-outcome/commands/remove-business-outcome';

/** Each command's route, with its input. */
export interface BusinessOutcomeCommands {
  '/api/business-outcome/add-business-outcome': AddBusinessOutcome;
  '/api/business-outcome/change-business-outcome': ChangeBusinessOutcome;
  '/api/business-outcome/remove-business-outcome': RemoveBusinessOutcome;
}

export type BusinessOutcomeRoute = keyof BusinessOutcomeCommands;

/** Sends one Business outcome command through the shell's writer: its route and its input, typed by the route. */
export const sendBusinessOutcome = <R extends BusinessOutcomeRoute>(writer: Writer, route: R, input: BusinessOutcomeCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
