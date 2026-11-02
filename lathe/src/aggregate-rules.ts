// Every aggregate's rules over all data, which every load and commit runs on the state it builds (store.ts). Each
// aggregate's handlers run the same rules on the instance they change; an aggregate with rules is listed here once.
import { extensionRecordRules } from './product/extension-record/rules.ts';
import { productRules } from './product/product/rules.ts';
import { aggregateRules } from './domain-modeling/aggregate/rules.ts';
import { commandRules } from './domain-modeling/command/rules.ts';
import { useCaseRules } from './use-cases/use-case/rules.ts';
import { journeyRules } from './product/journey/rules.ts';
import { domainRules } from './domain-modeling/domain/rules.ts';
import { readModelRules } from './domain-modeling/read-model/rules.ts';
import { tableRules } from './technical-specification/table/rules.ts';
import { valueObjectRules } from './domain-modeling/value-object/rules.ts';
import { specificationRules } from './domain-modeling/specification/rules.ts';
import { patternRules } from './use-cases/pattern/rules.ts';
import { domainEventRules } from './domain-modeling/domain-event/rules.ts';
import { endpointRules } from './interaction-design/endpoint/rules.ts';
import { integrationRules } from './interaction-design/integration/rules.ts';
import { interfaceRules } from './product/interface/rules.ts';
import { checkRules } from './checking/check/rules.ts';
import { productSettingRules } from './checking/product-setting/rules.ts';
import { patternFollowingRules } from './traceability/pattern-following/rules.ts';
import type { AggregateRules } from './platform/data/rules.ts';

export const AGGREGATE_RULES: readonly AggregateRules[] = [
  useCaseRules, journeyRules, domainRules, aggregateRules, commandRules, productRules, extensionRecordRules, readModelRules, tableRules,
  valueObjectRules, specificationRules, patternRules, domainEventRules, endpointRules, integrationRules, interfaceRules,
  checkRules, productSettingRules, patternFollowingRules,
];
