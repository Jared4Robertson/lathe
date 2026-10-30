// The View aggregate's commands as the app sends them (LA-AUT-A12): each route, POST /api/view/<command>, with its
// input, the type its command file declares. The view's editor sends only these, one command per change; a test holds
// this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddView } from '../../../../lathe/src/authoring/view/commands/add-view';
import type { AddViewRequirement } from '../../../../lathe/src/authoring/view/commands/add-view-requirement';
import type { AddViewTest } from '../../../../lathe/src/authoring/view/commands/add-view-test';
import type { ChangeView } from '../../../../lathe/src/authoring/view/commands/change-view';
import type { ChangeViewRequirement } from '../../../../lathe/src/authoring/view/commands/change-view-requirement';
import type { ChangeViewTest } from '../../../../lathe/src/authoring/view/commands/change-view-test';
import type { RemoveView } from '../../../../lathe/src/authoring/view/commands/remove-view';
import type { RemoveViewRequirement } from '../../../../lathe/src/authoring/view/commands/remove-view-requirement';
import type { RemoveViewTest } from '../../../../lathe/src/authoring/view/commands/remove-view-test';

/** Each command's route, with its input. */
export interface ViewCommands {
  '/api/view/add-view': AddView;
  '/api/view/add-view-requirement': AddViewRequirement;
  '/api/view/add-view-test': AddViewTest;
  '/api/view/change-view': ChangeView;
  '/api/view/change-view-requirement': ChangeViewRequirement;
  '/api/view/change-view-test': ChangeViewTest;
  '/api/view/remove-view': RemoveView;
  '/api/view/remove-view-requirement': RemoveViewRequirement;
  '/api/view/remove-view-test': RemoveViewTest;
}

export type ViewRoute = keyof ViewCommands;

/** Sends one View command through the shell's writer: its route and its input, typed by the route. */
export const sendView = <R extends ViewRoute>(writer: Writer, route: R, input: ViewCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
