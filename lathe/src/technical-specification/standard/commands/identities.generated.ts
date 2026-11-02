// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_STANDARD_IDENTITY = {
  id: 'LA-TEC-CMD200',
  slice: { aggregate: 'LA-TEC-A3', name: 'standard' },
  name: 'add-standard',
  description: 'Adds a standard to its product, with no rules yet.',
  method: 'POST',
  route: '/api/standard/add-standard',
} as const;

export const CHANGE_STANDARD_IDENTITY = {
  id: 'LA-TEC-CMD201',
  slice: { aggregate: 'LA-TEC-A3', name: 'standard' },
  name: 'change-standard',
  description: 'Changes a standard\'s title or description. Its product never changes.',
  method: 'POST',
  route: '/api/standard/change-standard',
} as const;

export const REMOVE_STANDARD_IDENTITY = {
  id: 'LA-TEC-CMD202',
  slice: { aggregate: 'LA-TEC-A3', name: 'standard' },
  name: 'remove-standard',
  description: 'Removes a standard whole: its rules and rule tests, and the links they start. Refused while anything outside it references what is in it, such as a technical record that meets a rule.',
  method: 'POST',
  route: '/api/standard/remove-standard',
} as const;

export const ADD_STANDARD_RULE_IDENTITY = {
  id: 'LA-TEC-CMD203',
  slice: { aggregate: 'LA-TEC-A3', name: 'standard' },
  name: 'add-standard-rule',
  description: 'Adds a rule to its standard.',
  method: 'POST',
  route: '/api/standard/add-standard-rule',
} as const;

export const CHANGE_STANDARD_RULE_IDENTITY = {
  id: 'LA-TEC-CMD204',
  slice: { aggregate: 'LA-TEC-A3', name: 'standard' },
  name: 'change-standard-rule',
  description: 'Changes a standard rule\'s title, statement or group.',
  method: 'POST',
  route: '/api/standard/change-standard-rule',
} as const;

export const REMOVE_STANDARD_RULE_IDENTITY = {
  id: 'LA-TEC-CMD205',
  slice: { aggregate: 'LA-TEC-A3', name: 'standard' },
  name: 'remove-standard-rule',
  description: 'Removes a standard rule with its tests and the links they start. Refused while a technical record meets it or anything else references it or its tests.',
  method: 'POST',
  route: '/api/standard/remove-standard-rule',
} as const;

export const ADD_STANDARD_RULE_TEST_IDENTITY = {
  id: 'LA-TEC-CMD206',
  slice: { aggregate: 'LA-TEC-A3', name: 'standard' },
  name: 'add-standard-rule-test',
  description: 'Adds a standard rule test under its rule, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/standard/add-standard-rule-test',
} as const;

export const CHANGE_STANDARD_RULE_TEST_IDENTITY = {
  id: 'LA-TEC-CMD207',
  slice: { aggregate: 'LA-TEC-A3', name: 'standard' },
  name: 'change-standard-rule-test',
  description: 'Changes a standard rule test\'s way of running or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/standard/change-standard-rule-test',
} as const;

export const REMOVE_STANDARD_RULE_TEST_IDENTITY = {
  id: 'LA-TEC-CMD208',
  slice: { aggregate: 'LA-TEC-A3', name: 'standard' },
  name: 'remove-standard-rule-test',
  description: 'Removes a standard rule test and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/standard/remove-standard-rule-test',
} as const;
