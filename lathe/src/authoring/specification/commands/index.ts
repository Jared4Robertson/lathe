// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_SPECIFICATION } from './add-specification.ts';
import { CHANGE_SPECIFICATION } from './change-specification.ts';
import { REMOVE_SPECIFICATION } from './remove-specification.ts';
import { ADD_PREDICATE } from './add-predicate.ts';
import { CHANGE_PREDICATE } from './change-predicate.ts';
import { REMOVE_PREDICATE } from './remove-predicate.ts';
import { ADD_SPECIFICATION_TEST } from './add-specification-test.ts';
import { CHANGE_SPECIFICATION_TEST } from './change-specification-test.ts';
import { REMOVE_SPECIFICATION_TEST } from './remove-specification-test.ts';

export const SPECIFICATION_COMMANDS = [
  ADD_SPECIFICATION,
  CHANGE_SPECIFICATION,
  REMOVE_SPECIFICATION,
  ADD_PREDICATE,
  CHANGE_PREDICATE,
  REMOVE_PREDICATE,
  ADD_SPECIFICATION_TEST,
  CHANGE_SPECIFICATION_TEST,
  REMOVE_SPECIFICATION_TEST,
] as const satisfies readonly AnyCommand[];
