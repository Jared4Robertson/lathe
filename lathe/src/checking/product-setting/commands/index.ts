// The Product setting aggregate's commands (LA-CHK-A2), as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { SET_LIMITS } from './set-limits.ts';

export const PRODUCT_SETTING_COMMANDS: readonly AnyCommand[] = [SET_LIMITS];
