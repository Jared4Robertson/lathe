// The Pattern following aggregate's commands (LA-TRC-A3), as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { CHANGE_SETTING_VALUES } from './change-setting-values.ts';
import { FOLLOW_PATTERN } from './follow-pattern.ts';
import { STOP_FOLLOWING_PATTERN } from './stop-following-pattern.ts';

export const PATTERN_FOLLOWING_COMMANDS: readonly AnyCommand[] = [FOLLOW_PATTERN, CHANGE_SETTING_VALUES, STOP_FOLLOWING_PATTERN];
