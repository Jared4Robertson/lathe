// Every aggregate's rules over all data, which every load and commit runs on the state it builds (store.ts). Each
// aggregate's handlers run the same rules on the instance they change; an aggregate with rules is listed here once.
import { useCaseRules } from './authoring/use-case/rules.ts';
import type { AggregateRules } from './platform/data/rules.ts';

export const AGGREGATE_RULES: readonly AggregateRules[] = [useCaseRules];
