// Every aggregate's commands and queries, as the CLI (`lathe <aggregate> <command>`), the MCP server (one tool each)
// and the HTTP API (`POST /api/<aggregate>/<command>`) register them. Each aggregate lists its own in its slice; an
// aggregate with commands is added here once.
import { BUSINESS_OUTCOME_COMMANDS } from './authoring/business-outcome/commands/index.ts';
import { BUSINESS_OUTCOME_QUERIES } from './authoring/business-outcome/queries.ts';
import { ENTRY_POINT_COMMANDS } from './authoring/entry-point/commands/index.ts';
import { ENTRY_POINT_QUERIES } from './authoring/entry-point/queries.ts';
import { EXTENSION_RECORD_COMMANDS } from './authoring/extension-record/commands/index.ts';
import { EXTENSION_RECORD_QUERIES } from './authoring/extension-record/queries.ts';
import { PRODUCT_COMMANDS } from './authoring/product/commands/index.ts';
import { PRODUCT_QUERIES } from './authoring/product/queries.ts';
import { TOOLING_COMMANDS } from './authoring/tooling/commands/index.ts';
import { TOOLING_QUERIES } from './authoring/tooling/queries.ts';
import { USE_CASE_COMMANDS } from './authoring/use-case/commands/index.ts';
import { USE_CASE_QUERIES } from './authoring/use-case/queries.ts';
import type { AnyCommand, AnyQuery } from './platform/commands/definition.ts';

export const ALL_COMMANDS: readonly AnyCommand[] = [
  ...USE_CASE_COMMANDS,
  ...PRODUCT_COMMANDS,
  ...BUSINESS_OUTCOME_COMMANDS,
  ...EXTENSION_RECORD_COMMANDS,
  ...ENTRY_POINT_COMMANDS,
  ...TOOLING_COMMANDS,
];

export const ALL_QUERIES: readonly AnyQuery[] = [
  ...USE_CASE_QUERIES,
  ...PRODUCT_QUERIES,
  ...BUSINESS_OUTCOME_QUERIES,
  ...EXTENSION_RECORD_QUERIES,
  ...ENTRY_POINT_QUERIES,
  ...TOOLING_QUERIES,
];
