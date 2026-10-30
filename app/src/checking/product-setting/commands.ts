// The Product setting aggregate's commands as the app sends them (LA-CHK-A2): each route, POST
// /api/product-setting/<command>, with its input, the type its command file declares. The Limits section sends only
// these, one command per change; a test holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { SetLimits } from '../../../../lathe/src/checking/product-setting/commands/set-limits';

/** Each command's route, with its input. */
export interface ProductSettingCommands {
  '/api/product-setting/set-limits': SetLimits;
}

export type ProductSettingRoute = keyof ProductSettingCommands;

/** Sends one Product setting command through the shell's writer: its route and its input, typed by the route. */
export const sendProductSetting = <R extends ProductSettingRoute>(writer: Writer, route: R, input: ProductSettingCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
