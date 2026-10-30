// The Pattern following aggregate's commands as the app sends them (LA-TRC-A3): each route, POST
// /api/pattern-following/<command>, with its input, the type its command file declares. The following's editor sends
// only these, one command per change; a test holds this list to the aggregate's command definitions, one to one.
import type { WriteAnswer } from '../../../../lathe/src/server/contract';
import type { Writer } from '../../edit/write';
import type { ChangeSettingValues } from '../../../../lathe/src/traceability/pattern-following/commands/change-setting-values';
import type { FollowPattern } from '../../../../lathe/src/traceability/pattern-following/commands/follow-pattern';
import type { StopFollowingPattern } from '../../../../lathe/src/traceability/pattern-following/commands/stop-following-pattern';

/** Each command's route, with its input. */
export interface PatternFollowingCommands {
  '/api/pattern-following/follow-pattern': FollowPattern;
  '/api/pattern-following/change-setting-values': ChangeSettingValues;
  '/api/pattern-following/stop-following-pattern': StopFollowingPattern;
}

export type PatternFollowingRoute = keyof PatternFollowingCommands;

/** Sends one Pattern following command through the shell's writer: its route and its input, typed by the route. */
export const sendPatternFollowing = <R extends PatternFollowingRoute>(writer: Writer, route: R, input: PatternFollowingCommands[R]): Promise<WriteAnswer> => writer.command(route, input);
