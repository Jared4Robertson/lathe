// The Standard aggregate's commands as the app sends them (LA-AUT-A3): each route, POST /api/standard/<command>, with
// its input, the type its command file declares. The standard's editor sends only these, one command per change; a test
// holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddStandard } from '../../../../lathe/src/authoring/standard/commands/add-standard';
import type { AddStandardRule } from '../../../../lathe/src/authoring/standard/commands/add-standard-rule';
import type { AddStandardRuleTest } from '../../../../lathe/src/authoring/standard/commands/add-standard-rule-test';
import type { ChangeStandard } from '../../../../lathe/src/authoring/standard/commands/change-standard';
import type { ChangeStandardRule } from '../../../../lathe/src/authoring/standard/commands/change-standard-rule';
import type { ChangeStandardRuleTest } from '../../../../lathe/src/authoring/standard/commands/change-standard-rule-test';
import type { RemoveStandard } from '../../../../lathe/src/authoring/standard/commands/remove-standard';
import type { RemoveStandardRule } from '../../../../lathe/src/authoring/standard/commands/remove-standard-rule';
import type { RemoveStandardRuleTest } from '../../../../lathe/src/authoring/standard/commands/remove-standard-rule-test';

/** Each command's route, with its input. */
export interface StandardCommands {
  '/api/standard/add-standard': AddStandard;
  '/api/standard/add-standard-rule': AddStandardRule;
  '/api/standard/add-standard-rule-test': AddStandardRuleTest;
  '/api/standard/change-standard': ChangeStandard;
  '/api/standard/change-standard-rule': ChangeStandardRule;
  '/api/standard/change-standard-rule-test': ChangeStandardRuleTest;
  '/api/standard/remove-standard': RemoveStandard;
  '/api/standard/remove-standard-rule': RemoveStandardRule;
  '/api/standard/remove-standard-rule-test': RemoveStandardRuleTest;
}

export type StandardRoute = keyof StandardCommands;

/** Sends one Standard command through the shell's writer: its route and its input, typed by the route. */
export const sendStandard = <R extends StandardRoute>(writer: Writer, route: R, input: StandardCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
