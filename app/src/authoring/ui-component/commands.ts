// The UI component aggregate's commands as the app sends them (LA-AUT-A15): each route, POST /api/ui-component/<command>,
// with its input, the type its command file declares. The UI component's editor sends only these, one command per
// change; a test holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddUiComponent } from '../../../../lathe/src/authoring/ui-component/commands/add-ui-component';
import type { ChangeUiComponent } from '../../../../lathe/src/authoring/ui-component/commands/change-ui-component';
import type { RemoveUiComponent } from '../../../../lathe/src/authoring/ui-component/commands/remove-ui-component';

/** Each command's route, with its input. */
export interface UiComponentCommands {
  '/api/ui-component/add-ui-component': AddUiComponent;
  '/api/ui-component/change-ui-component': ChangeUiComponent;
  '/api/ui-component/remove-ui-component': RemoveUiComponent;
}

export type UiComponentRoute = keyof UiComponentCommands;

/** Sends one UI component command through the shell's writer: its route and its input, typed by the route. */
export const sendUiComponent = <R extends UiComponentRoute>(writer: Writer, route: R, input: UiComponentCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
