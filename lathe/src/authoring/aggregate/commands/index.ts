// The Aggregate aggregate's commands (LA-AUT-A6), as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_AGGREGATE } from './add-aggregate.ts';
import { CHANGE_AGGREGATE } from './change-aggregate.ts';
import { REMOVE_AGGREGATE } from './remove-aggregate.ts';
import { ADD_ENTITY } from './add-entity.ts';
import { CHANGE_ENTITY } from './change-entity.ts';
import { REMOVE_ENTITY } from './remove-entity.ts';
import { ADD_INVARIANT } from './add-invariant.ts';
import { CHANGE_INVARIANT } from './change-invariant.ts';
import { REMOVE_INVARIANT } from './remove-invariant.ts';
import { ADD_DATA_MODEL } from './add-data-model.ts';
import { CHANGE_DATA_MODEL } from './change-data-model.ts';
import { REMOVE_DATA_MODEL } from './remove-data-model.ts';
import { ADD_RULE } from './add-rule.ts';
import { CHANGE_RULE } from './change-rule.ts';
import { REMOVE_RULE } from './remove-rule.ts';
import { ADD_INVARIANT_TEST } from './add-invariant-test.ts';
import { CHANGE_INVARIANT_TEST } from './change-invariant-test.ts';
import { REMOVE_INVARIANT_TEST } from './remove-invariant-test.ts';

export const AGGREGATE_COMMANDS: readonly AnyCommand[] = [
  ADD_AGGREGATE,
  CHANGE_AGGREGATE,
  REMOVE_AGGREGATE,
  ADD_ENTITY,
  CHANGE_ENTITY,
  REMOVE_ENTITY,
  ADD_INVARIANT,
  CHANGE_INVARIANT,
  REMOVE_INVARIANT,
  ADD_DATA_MODEL,
  CHANGE_DATA_MODEL,
  REMOVE_DATA_MODEL,
  ADD_RULE,
  CHANGE_RULE,
  REMOVE_RULE,
  ADD_INVARIANT_TEST,
  CHANGE_INVARIANT_TEST,
  REMOVE_INVARIANT_TEST,
];
