// The Business outcome aggregate's commands (LA-AUT-A16), as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_BUSINESS_OUTCOME } from './add-business-outcome.ts';
import { CHANGE_BUSINESS_OUTCOME } from './change-business-outcome.ts';
import { REMOVE_BUSINESS_OUTCOME } from './remove-business-outcome.ts';

export const BUSINESS_OUTCOME_COMMANDS: readonly AnyCommand[] = [ADD_BUSINESS_OUTCOME, CHANGE_BUSINESS_OUTCOME, REMOVE_BUSINESS_OUTCOME];
