// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_PATTERN } from './add-pattern.ts';
import { CHANGE_PATTERN } from './change-pattern.ts';
import { REMOVE_PATTERN } from './remove-pattern.ts';
import { ADD_PATTERN_RULE } from './add-pattern-rule.ts';
import { CHANGE_PATTERN_RULE } from './change-pattern-rule.ts';
import { REMOVE_PATTERN_RULE } from './remove-pattern-rule.ts';
import { ADD_PATTERN_RULE_TEST } from './add-pattern-rule-test.ts';
import { CHANGE_PATTERN_RULE_TEST } from './change-pattern-rule-test.ts';
import { REMOVE_PATTERN_RULE_TEST } from './remove-pattern-rule-test.ts';
import { ADD_SLOT } from './add-slot.ts';
import { CHANGE_SLOT } from './change-slot.ts';
import { REMOVE_SLOT } from './remove-slot.ts';

export const PATTERN_COMMANDS = [
  ADD_PATTERN,
  CHANGE_PATTERN,
  REMOVE_PATTERN,
  ADD_PATTERN_RULE,
  CHANGE_PATTERN_RULE,
  REMOVE_PATTERN_RULE,
  ADD_PATTERN_RULE_TEST,
  CHANGE_PATTERN_RULE_TEST,
  REMOVE_PATTERN_RULE_TEST,
  ADD_SLOT,
  CHANGE_SLOT,
  REMOVE_SLOT,
] as const satisfies readonly AnyCommand[];
