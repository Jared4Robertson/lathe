// The Extension record aggregate's commands as the app sends them (LA-AUT-A19): each route, POST
// /api/extension-record/<command>, with its input, the type its command file declares. A record's editor sends only
// these, one command per change; a test holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddExtensionRecord } from '../../../../lathe/src/authoring/extension-record/commands/add-extension-record';
import type { ChangeExtensionRecord } from '../../../../lathe/src/authoring/extension-record/commands/change-extension-record';
import type { RemoveExtensionRecord } from '../../../../lathe/src/authoring/extension-record/commands/remove-extension-record';

/** Each command's route, with its input. */
export interface ExtensionRecordCommands {
  '/api/extension-record/add-extension-record': AddExtensionRecord;
  '/api/extension-record/change-extension-record': ChangeExtensionRecord;
  '/api/extension-record/remove-extension-record': RemoveExtensionRecord;
}

export type ExtensionRecordRoute = keyof ExtensionRecordCommands;

/** Sends one Extension record command through the shell's writer: its route and its input, typed by the route. */
export const sendExtensionRecord = <R extends ExtensionRecordRoute>(writer: Writer, route: R, input: ExtensionRecordCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
