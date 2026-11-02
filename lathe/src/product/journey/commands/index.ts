// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_JOURNEY } from './add-journey.ts';
import { CHANGE_JOURNEY } from './change-journey.ts';
import { REMOVE_JOURNEY } from './remove-journey.ts';
import { ADD_JOURNEY_STEP } from './add-journey-step.ts';
import { CHANGE_JOURNEY_STEP } from './change-journey-step.ts';
import { MOVE_JOURNEY_STEP } from './move-journey-step.ts';
import { REMOVE_JOURNEY_STEP } from './remove-journey-step.ts';
import { ADD_JOURNEY_TEST } from './add-journey-test.ts';
import { CHANGE_JOURNEY_TEST } from './change-journey-test.ts';
import { REMOVE_JOURNEY_TEST } from './remove-journey-test.ts';

export const JOURNEY_COMMANDS = [
  ADD_JOURNEY,
  CHANGE_JOURNEY,
  REMOVE_JOURNEY,
  ADD_JOURNEY_STEP,
  CHANGE_JOURNEY_STEP,
  MOVE_JOURNEY_STEP,
  REMOVE_JOURNEY_STEP,
  ADD_JOURNEY_TEST,
  CHANGE_JOURNEY_TEST,
  REMOVE_JOURNEY_TEST,
] as const satisfies readonly AnyCommand[];
