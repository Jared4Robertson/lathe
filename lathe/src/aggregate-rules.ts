// Every aggregate's rules over all data, which every load and commit runs on the state it builds (store.ts). Each
// aggregate's handlers run the same rules on the instance they change; an aggregate with rules is listed here once.
import { extensionRecordRules } from './authoring/extension-record/rules.ts';
import { productRules } from './authoring/product/rules.ts';
import { useCaseRules } from './authoring/use-case/rules.ts';
import { domainRules } from './authoring/domain/rules.ts';
import type { AggregateRules } from './platform/data/rules.ts';

export const AGGREGATE_RULES: readonly AggregateRules[] = [useCaseRules, domainRules, productRules, extensionRecordRules];
