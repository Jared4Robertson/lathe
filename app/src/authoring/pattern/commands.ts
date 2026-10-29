// The Pattern aggregate's commands as the app sends them (LA-AUT-A2): each route, POST /api/pattern/<command>, with
// its input, the type its command file declares. The pattern's editor sends only these, one command per change; a test
// holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { AddPattern } from '../../../../lathe/src/authoring/pattern/commands/add-pattern';
import type { AddPatternRule } from '../../../../lathe/src/authoring/pattern/commands/add-pattern-rule';
import type { AddPatternRuleTest } from '../../../../lathe/src/authoring/pattern/commands/add-pattern-rule-test';
import type { ChangePattern } from '../../../../lathe/src/authoring/pattern/commands/change-pattern';
import type { ChangePatternRule } from '../../../../lathe/src/authoring/pattern/commands/change-pattern-rule';
import type { ChangePatternRuleTest } from '../../../../lathe/src/authoring/pattern/commands/change-pattern-rule-test';
import type { RemovePattern } from '../../../../lathe/src/authoring/pattern/commands/remove-pattern';
import type { RemovePatternRule } from '../../../../lathe/src/authoring/pattern/commands/remove-pattern-rule';
import type { RemovePatternRuleTest } from '../../../../lathe/src/authoring/pattern/commands/remove-pattern-rule-test';

/** Each command's route, with its input. */
export interface PatternCommands {
  '/api/pattern/add-pattern': AddPattern;
  '/api/pattern/add-pattern-rule': AddPatternRule;
  '/api/pattern/add-pattern-rule-test': AddPatternRuleTest;
  '/api/pattern/change-pattern': ChangePattern;
  '/api/pattern/change-pattern-rule': ChangePatternRule;
  '/api/pattern/change-pattern-rule-test': ChangePatternRuleTest;
  '/api/pattern/remove-pattern': RemovePattern;
  '/api/pattern/remove-pattern-rule': RemovePatternRule;
  '/api/pattern/remove-pattern-rule-test': RemovePatternRuleTest;
}

export type PatternRoute = keyof PatternCommands;

/** Sends one Pattern command through the shell's writer: its route and its input, typed by the route. */
export const sendPattern = <R extends PatternRoute>(writer: Writer, route: R, input: PatternCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
