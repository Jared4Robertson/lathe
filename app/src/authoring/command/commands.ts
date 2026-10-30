// The Command aggregate's commands as the app sends them (LA-AUT-A8): each route, POST /api/command/<command>, with
// its input, the type its command file declares. The editor sends only these, one command per change; a test holds
// this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddCommand } from '../../../../lathe/src/authoring/command/commands/add-command';
import type { AddCommandHandler } from '../../../../lathe/src/authoring/command/commands/add-command-handler';
import type { AddEventHandler } from '../../../../lathe/src/authoring/command/commands/add-event-handler';
import type { AddPolicy } from '../../../../lathe/src/authoring/command/commands/add-policy';
import type { AddPolicyTest } from '../../../../lathe/src/authoring/command/commands/add-policy-test';
import type { ChangeCommand } from '../../../../lathe/src/authoring/command/commands/change-command';
import type { ChangeCommandHandler } from '../../../../lathe/src/authoring/command/commands/change-command-handler';
import type { ChangeEventHandler } from '../../../../lathe/src/authoring/command/commands/change-event-handler';
import type { ChangePolicy } from '../../../../lathe/src/authoring/command/commands/change-policy';
import type { ChangePolicyTest } from '../../../../lathe/src/authoring/command/commands/change-policy-test';
import type { RemoveCommand } from '../../../../lathe/src/authoring/command/commands/remove-command';
import type { RemoveCommandHandler } from '../../../../lathe/src/authoring/command/commands/remove-command-handler';
import type { RemoveEventHandler } from '../../../../lathe/src/authoring/command/commands/remove-event-handler';
import type { RemovePolicy } from '../../../../lathe/src/authoring/command/commands/remove-policy';
import type { RemovePolicyTest } from '../../../../lathe/src/authoring/command/commands/remove-policy-test';

/** Each command's route, with its input. */
export interface CommandCommands {
  '/api/command/add-command': AddCommand;
  '/api/command/add-command-handler': AddCommandHandler;
  '/api/command/add-event-handler': AddEventHandler;
  '/api/command/add-policy': AddPolicy;
  '/api/command/add-policy-test': AddPolicyTest;
  '/api/command/change-command': ChangeCommand;
  '/api/command/change-command-handler': ChangeCommandHandler;
  '/api/command/change-event-handler': ChangeEventHandler;
  '/api/command/change-policy': ChangePolicy;
  '/api/command/change-policy-test': ChangePolicyTest;
  '/api/command/remove-command': RemoveCommand;
  '/api/command/remove-command-handler': RemoveCommandHandler;
  '/api/command/remove-event-handler': RemoveEventHandler;
  '/api/command/remove-policy': RemovePolicy;
  '/api/command/remove-policy-test': RemovePolicyTest;
}

export type CommandRoute = keyof CommandCommands;

/** Sends one Command command through the shell's writer: its route and its input, typed by the route. */
export const sendCommand = <R extends CommandRoute>(writer: Writer, route: R, input: CommandCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
