// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { SET_LIMITS } from './set-limits.ts';
import { SET_TECHNOLOGY_WORDS } from './set-technology-words.ts';
import { SET_STRICT_CHECK } from './set-strict-check.ts';

export const PRODUCT_SETTING_COMMANDS = [
  SET_LIMITS,
  SET_TECHNOLOGY_WORDS,
  SET_STRICT_CHECK,
] as const satisfies readonly AnyCommand[];
