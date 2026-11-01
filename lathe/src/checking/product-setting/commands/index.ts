// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { SET_LIMITS } from './set-limits.ts';
import { SET_TECHNOLOGY_WORDS } from './set-technology-words.ts';

export const PRODUCT_SETTING_COMMANDS = [
  SET_LIMITS,
  SET_TECHNOLOGY_WORDS,
] as const satisfies readonly AnyCommand[];
