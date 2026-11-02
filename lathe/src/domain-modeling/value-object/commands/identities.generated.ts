// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_VALUE_OBJECT_IDENTITY = {
  id: 'LA-MOD-CMD270',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'add-value-object',
  description: 'Adds a value object, in the product its ID names, with its fields in order.',
  method: 'POST',
  route: '/api/value-object/add-value-object',
} as const;

export const CHANGE_VALUE_OBJECT_IDENTITY = {
  id: 'LA-MOD-CMD271',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'change-value-object',
  description: 'Changes a value object\'s title or description, or its fields (the whole list, in order).',
  method: 'POST',
  route: '/api/value-object/change-value-object',
} as const;

export const REMOVE_VALUE_OBJECT_IDENTITY = {
  id: 'LA-MOD-CMD272',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'remove-value-object',
  description: 'Removes a value object whole: its fields, constraints with their tests and its value type, and the links they start. Refused while anything outside it references what is in it, such as a field it types.',
  method: 'POST',
  route: '/api/value-object/remove-value-object',
} as const;

export const ADD_CONSTRAINT_IDENTITY = {
  id: 'LA-MOD-CMD273',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'add-constraint',
  description: 'Adds a constraint to its value object: a rule each value is held to when it is created.',
  method: 'POST',
  route: '/api/value-object/add-constraint',
} as const;

export const CHANGE_CONSTRAINT_IDENTITY = {
  id: 'LA-MOD-CMD274',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'change-constraint',
  description: 'Changes a constraint\'s title or statement. Its value object never changes.',
  method: 'POST',
  route: '/api/value-object/change-constraint',
} as const;

export const REMOVE_CONSTRAINT_IDENTITY = {
  id: 'LA-MOD-CMD275',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'remove-constraint',
  description: 'Removes a constraint with its test and the links it starts. Refused while anything else references them.',
  method: 'POST',
  route: '/api/value-object/remove-constraint',
} as const;

export const ADD_VALUE_TYPE_IDENTITY = {
  id: 'LA-MOD-CMD276',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'add-value-type',
  description: 'Adds the value type of a value object, its one piece of code, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/value-object/add-value-type',
} as const;

export const CHANGE_VALUE_TYPE_IDENTITY = {
  id: 'LA-MOD-CMD277',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'change-value-type',
  description: 'Changes a value type\'s title or file, or the standard rules it meets or packages it uses (each the whole list).',
  method: 'POST',
  route: '/api/value-object/change-value-type',
} as const;

export const REMOVE_VALUE_TYPE_IDENTITY = {
  id: 'LA-MOD-CMD278',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'remove-value-type',
  description: 'Removes a value object\'s value type with the links it starts and the packages it uses. Refused while anything references it.',
  method: 'POST',
  route: '/api/value-object/remove-value-type',
} as const;

export const ADD_CONSTRAINT_TEST_IDENTITY = {
  id: 'LA-MOD-CMD279',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'add-constraint-test',
  description: 'Adds the test of a constraint, its one test, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/value-object/add-constraint-test',
} as const;

export const CHANGE_CONSTRAINT_TEST_IDENTITY = {
  id: 'LA-MOD-CMD280',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'change-constraint-test',
  description: 'Changes a constraint test\'s way of running or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/value-object/change-constraint-test',
} as const;

export const REMOVE_CONSTRAINT_TEST_IDENTITY = {
  id: 'LA-MOD-CMD281',
  slice: { aggregate: 'LA-MOD-A9', name: 'value-object' },
  name: 'remove-constraint-test',
  description: 'Removes a constraint\'s test with the links it starts. Refused while anything references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/value-object/remove-constraint-test',
} as const;
