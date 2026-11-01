// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_USE_CASE } from './add-use-case.ts';
import { CHANGE_USE_CASE } from './change-use-case.ts';
import { MOVE_USE_CASE } from './move-use-case.ts';
import { REMOVE_USE_CASE } from './remove-use-case.ts';
import { ADD_UC_REQUIREMENT } from './add-uc-requirement.ts';
import { CHANGE_UC_REQUIREMENT } from './change-uc-requirement.ts';
import { REMOVE_UC_REQUIREMENT } from './remove-uc-requirement.ts';
import { ADD_FLOW } from './add-flow.ts';
import { CHANGE_FLOW } from './change-flow.ts';
import { REMOVE_FLOW } from './remove-flow.ts';
import { ADD_FLOW_STEP } from './add-flow-step.ts';
import { CHANGE_FLOW_STEP } from './change-flow-step.ts';
import { REMOVE_FLOW_STEP } from './remove-flow-step.ts';
import { ADD_USE_CASE_TEST } from './add-use-case-test.ts';
import { CHANGE_USE_CASE_TEST } from './change-use-case-test.ts';
import { REMOVE_USE_CASE_TEST } from './remove-use-case-test.ts';
import { ADD_FLOW_TEST } from './add-flow-test.ts';
import { CHANGE_FLOW_TEST } from './change-flow-test.ts';
import { REMOVE_FLOW_TEST } from './remove-flow-test.ts';

export const USE_CASE_COMMANDS = [
  ADD_USE_CASE,
  CHANGE_USE_CASE,
  MOVE_USE_CASE,
  REMOVE_USE_CASE,
  ADD_UC_REQUIREMENT,
  CHANGE_UC_REQUIREMENT,
  REMOVE_UC_REQUIREMENT,
  ADD_FLOW,
  CHANGE_FLOW,
  REMOVE_FLOW,
  ADD_FLOW_STEP,
  CHANGE_FLOW_STEP,
  REMOVE_FLOW_STEP,
  ADD_USE_CASE_TEST,
  CHANGE_USE_CASE_TEST,
  REMOVE_USE_CASE_TEST,
  ADD_FLOW_TEST,
  CHANGE_FLOW_TEST,
  REMOVE_FLOW_TEST,
] as const satisfies readonly AnyCommand[];
