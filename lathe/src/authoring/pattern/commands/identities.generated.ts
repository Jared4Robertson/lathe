// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_PATTERN_IDENTITY = {
  id: 'LA-AUT-CMD190',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'add-pattern',
  description: 'Adds a pattern to its product, with its settings in order.',
  method: 'POST',
  route: '/api/pattern/add-pattern',
} as const;

export const CHANGE_PATTERN_IDENTITY = {
  id: 'LA-AUT-CMD191',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'change-pattern',
  description: 'Changes a pattern\'s title, description or notes, or its settings (the whole list, in order). Its product never changes.',
  method: 'POST',
  route: '/api/pattern/change-pattern',
} as const;

export const REMOVE_PATTERN_IDENTITY = {
  id: 'LA-AUT-CMD192',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'remove-pattern',
  description: 'Removes a pattern whole: its settings, rules and rule tests, and the links they start. Refused while anything outside it references what is in it, such as a follower.',
  method: 'POST',
  route: '/api/pattern/remove-pattern',
} as const;

export const ADD_PATTERN_RULE_IDENTITY = {
  id: 'LA-AUT-CMD193',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'add-pattern-rule',
  description: 'Adds a rule to its pattern, owed by every follower.',
  method: 'POST',
  route: '/api/pattern/add-pattern-rule',
} as const;

export const CHANGE_PATTERN_RULE_IDENTITY = {
  id: 'LA-AUT-CMD194',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'change-pattern-rule',
  description: 'Changes a pattern rule\'s title, statement, group or notes.',
  method: 'POST',
  route: '/api/pattern/change-pattern-rule',
} as const;

export const REMOVE_PATTERN_RULE_IDENTITY = {
  id: 'LA-AUT-CMD195',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'remove-pattern-rule',
  description: 'Removes a pattern rule with its tests and the links they start. Refused while anything references it or them.',
  method: 'POST',
  route: '/api/pattern/remove-pattern-rule',
} as const;

export const ADD_PATTERN_RULE_TEST_IDENTITY = {
  id: 'LA-AUT-CMD196',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'add-pattern-rule-test',
  description: 'Adds a test of a pattern rule in one domain that follows its pattern, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/pattern/add-pattern-rule-test',
} as const;

export const CHANGE_PATTERN_RULE_TEST_IDENTITY = {
  id: 'LA-AUT-CMD197',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'change-pattern-rule-test',
  description: 'Changes a pattern rule test\'s columns, the domain it proves the rule in, or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/pattern/change-pattern-rule-test',
} as const;

export const REMOVE_PATTERN_RULE_TEST_IDENTITY = {
  id: 'LA-AUT-CMD198',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'remove-pattern-rule-test',
  description: 'Removes a pattern rule test and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/pattern/remove-pattern-rule-test',
} as const;

export const ADD_SLOT_IDENTITY = {
  id: 'LA-AUT-CMD373',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'add-slot',
  description: 'Adds a slot to its pattern: an open-ended part code fills against its contract.',
  method: 'POST',
  route: '/api/pattern/add-slot',
} as const;

export const CHANGE_SLOT_IDENTITY = {
  id: 'LA-AUT-CMD374',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'change-slot',
  description: 'Changes a slot\'s title or contract. Its pattern does not change.',
  method: 'POST',
  route: '/api/pattern/change-slot',
} as const;

export const REMOVE_SLOT_IDENTITY = {
  id: 'LA-AUT-CMD375',
  slice: { aggregate: 'LA-AUT-A2', name: 'pattern' },
  name: 'remove-slot',
  description: 'Removes a slot from its pattern. Refused while a record fills it.',
  method: 'POST',
  route: '/api/pattern/remove-slot',
} as const;
