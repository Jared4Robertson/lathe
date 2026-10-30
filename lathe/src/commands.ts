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
import { SPECIFICATION_COMMANDS } from './authoring/specification/commands/index.ts';
import { SPECIFICATION_QUERIES } from './authoring/specification/queries.ts';
import { VALUE_OBJECT_COMMANDS } from './authoring/value-object/commands/index.ts';
import { VALUE_OBJECT_QUERIES } from './authoring/value-object/queries.ts';
import { READ_MODEL_COMMANDS } from './authoring/read-model/commands/index.ts';
import { READ_MODEL_QUERIES } from './authoring/read-model/queries.ts';
import { TABLE_COMMANDS } from './authoring/table/commands/index.ts';
import { TABLE_QUERIES } from './authoring/table/queries.ts';
import { VIEW_COMMANDS } from './authoring/view/commands/index.ts';
import { VIEW_QUERIES } from './authoring/view/queries.ts';
import { ENDPOINT_COMMANDS } from './authoring/endpoint/commands/index.ts';
import { ENDPOINT_QUERIES } from './authoring/endpoint/queries.ts';
import { INTEGRATION_COMMANDS } from './authoring/integration/commands/index.ts';
import { INTEGRATION_QUERIES } from './authoring/integration/queries.ts';
import { UI_COMPONENT_COMMANDS } from './authoring/ui-component/commands/index.ts';
import { UI_COMPONENT_QUERIES } from './authoring/ui-component/queries.ts';
import { CHECK_COMMANDS } from './checking/check/commands/index.ts';
import { CHECK_QUERIES } from './checking/check/queries.ts';
import { PRODUCT_SETTING_COMMANDS } from './checking/product-setting/commands/index.ts';
import { PRODUCT_SETTING_QUERIES } from './checking/product-setting/queries.ts';
import { PATTERN_FOLLOWING_COMMANDS } from './traceability/pattern-following/commands/index.ts';
import { PATTERN_FOLLOWING_QUERIES } from './traceability/pattern-following/queries.ts';
import { PROBLEMS_QUERIES } from './checking/problems/queries.ts';
import { TRACE_QUERIES } from './traceability/trace/queries.ts';
import type { AnyCommand, AnyQuery } from './platform/commands/definition.ts';

export const ALL_COMMANDS: readonly AnyCommand[] = [
  ...USE_CASE_COMMANDS,
  ...PRODUCT_COMMANDS,
  ...BUSINESS_OUTCOME_COMMANDS,
  ...EXTENSION_RECORD_COMMANDS,
  ...ENTRY_POINT_COMMANDS,
  ...TOOLING_COMMANDS,
  ...DOMAIN_COMMANDS,
  ...TEST_DATA_SET_COMMANDS,
  ...PATTERN_COMMANDS,
  ...STANDARD_COMMANDS,
  ...AGGREGATE_COMMANDS,
  ...DOMAIN_EVENT_COMMANDS,
  ...COMMAND_COMMANDS,
  ...SPECIFICATION_COMMANDS,
  ...VALUE_OBJECT_COMMANDS,
  ...READ_MODEL_COMMANDS,
  ...TABLE_COMMANDS,
  ...VIEW_COMMANDS,
  ...ENDPOINT_COMMANDS,
  ...INTEGRATION_COMMANDS,
  ...UI_COMPONENT_COMMANDS,
  ...CHECK_COMMANDS,
  ...PRODUCT_SETTING_COMMANDS,
  ...PATTERN_FOLLOWING_COMMANDS,
];

export const ALL_QUERIES: readonly AnyQuery[] = [
  ...USE_CASE_QUERIES,
  ...PRODUCT_QUERIES,
  ...BUSINESS_OUTCOME_QUERIES,
  ...EXTENSION_RECORD_QUERIES,
  ...ENTRY_POINT_QUERIES,
  ...TOOLING_QUERIES,
  ...DOMAIN_QUERIES,
  ...TEST_DATA_SET_QUERIES,
  ...PATTERN_QUERIES,
  ...STANDARD_QUERIES,
  ...AGGREGATE_QUERIES,
  ...DOMAIN_EVENT_QUERIES,
  ...COMMAND_QUERIES,
  ...SPECIFICATION_QUERIES,
  ...VALUE_OBJECT_QUERIES,
  ...READ_MODEL_QUERIES,
  ...TABLE_QUERIES,
  ...VIEW_QUERIES,
  ...ENDPOINT_QUERIES,
  ...INTEGRATION_QUERIES,
  ...UI_COMPONENT_QUERIES,
  ...CHECK_QUERIES,
  ...PRODUCT_SETTING_QUERIES,
  ...PATTERN_FOLLOWING_QUERIES,
  ...PROBLEMS_QUERIES,
  ...TRACE_QUERIES,
];
