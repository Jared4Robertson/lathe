// Every aggregate's commands and queries, as the CLI (`lathe <aggregate> <command>`), the MCP server (one tool each)
// and the HTTP API (`POST /api/<aggregate>/<command>`) register them. Each aggregate lists its own in its slice; an
// aggregate with commands is added here once.
import { AGGREGATE_COMMANDS } from './authoring/aggregate/commands/index.ts';
import { AGGREGATE_QUERIES } from './authoring/aggregate/queries.ts';
import { COMMAND_COMMANDS } from './authoring/command/commands/index.ts';
import { COMMAND_QUERIES } from './authoring/command/queries.ts';
import { DOMAIN_EVENT_COMMANDS } from './authoring/domain-event/commands/index.ts';
import { DOMAIN_EVENT_QUERIES } from './authoring/domain-event/queries.ts';
import { USE_CASE_COMMANDS } from './authoring/use-case/commands/index.ts';
import { USE_CASE_QUERIES } from './authoring/use-case/queries.ts';
import { DOMAIN_COMMANDS } from './authoring/domain/commands/index.ts';
import { DOMAIN_QUERIES } from './authoring/domain/queries.ts';
import { TEST_DATA_SET_COMMANDS } from './authoring/test-data-set/commands/index.ts';
import { TEST_DATA_SET_QUERIES } from './authoring/test-data-set/queries.ts';
import { PATTERN_COMMANDS } from './authoring/pattern/commands/index.ts';
import { PATTERN_QUERIES } from './authoring/pattern/queries.ts';
import { STANDARD_COMMANDS } from './authoring/standard/commands/index.ts';
import { STANDARD_QUERIES } from './authoring/standard/queries.ts';
import type { AnyCommand, AnyQuery } from './platform/commands/definition.ts';

export const ALL_COMMANDS: readonly AnyCommand[] = [
  ...USE_CASE_COMMANDS,
  ...DOMAIN_COMMANDS,
  ...TEST_DATA_SET_COMMANDS,
  ...PATTERN_COMMANDS,
  ...STANDARD_COMMANDS,
  ...AGGREGATE_COMMANDS,
  ...DOMAIN_EVENT_COMMANDS,
  ...COMMAND_COMMANDS,
];

export const ALL_QUERIES: readonly AnyQuery[] = [
  ...USE_CASE_QUERIES,
  ...DOMAIN_QUERIES,
  ...TEST_DATA_SET_QUERIES,
  ...PATTERN_QUERIES,
  ...STANDARD_QUERIES,
  ...AGGREGATE_QUERIES,
  ...DOMAIN_EVENT_QUERIES,
  ...COMMAND_QUERIES,
];
