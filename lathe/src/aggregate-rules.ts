// Every aggregate's rules over all data, which every load and commit runs on the state it builds (store.ts). Each
// aggregate's handlers run the same rules on the instance they change; an aggregate with rules is listed here once.
import { extensionRecordRules } from './authoring/extension-record/rules.ts';
import { productRules } from './authoring/product/rules.ts';
import { aggregateRules } from './authoring/aggregate/rules.ts';
import { commandRules } from './authoring/command/rules.ts';
import { useCaseRules } from './authoring/use-case/rules.ts';
import { journeyRules } from './authoring/journey/rules.ts';
import { domainRules } from './authoring/domain/rules.ts';
import { readModelRules } from './authoring/read-model/rules.ts';
import { tableRules } from './authoring/table/rules.ts';
import { valueObjectRules } from './authoring/value-object/rules.ts';
import { specificationRules } from './authoring/specification/rules.ts';
import { patternRules } from './authoring/pattern/rules.ts';
import { domainEventRules } from './authoring/domain-event/rules.ts';
import { endpointRules } from './authoring/endpoint/rules.ts';
import { integrationRules } from './authoring/integration/rules.ts';
import { interfaceRules } from './authoring/interface/rules.ts';
import { checkRules } from './checking/check/rules.ts';
import { productSettingRules } from './checking/product-setting/rules.ts';
import { patternFollowingRules } from './traceability/pattern-following/rules.ts';
import type { AggregateRules } from './platform/data/rules.ts';

export const AGGREGATE_RULES: readonly AggregateRules[] = [
  useCaseRules, journeyRules, domainRules, aggregateRules, commandRules, productRules, extensionRecordRules, readModelRules, tableRules,
  valueObjectRules, specificationRules, patternRules, domainEventRules, endpointRules, integrationRules, interfaceRules,
  checkRules, productSettingRules, patternFollowingRules,
];
