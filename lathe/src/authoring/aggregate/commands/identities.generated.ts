// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_AGGREGATE_IDENTITY = {
  id: 'LA-AUT-CMD210',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'add-aggregate',
  description: 'Adds an aggregate under a domain, with nothing in it yet.',
  method: 'POST',
  route: '/api/aggregate/add-aggregate',
} as const;

export const CHANGE_AGGREGATE_IDENTITY = {
  id: 'LA-AUT-CMD211',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'change-aggregate',
  description: 'Changes an aggregate\'s title, description, identity or notes. Its domain does not change.',
  method: 'POST',
  route: '/api/aggregate/change-aggregate',
} as const;

export const REMOVE_AGGREGATE_IDENTITY = {
  id: 'LA-AUT-CMD212',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'remove-aggregate',
  description: 'Removes an aggregate whole: its entities and their fields, data models, invariants with their rules, tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/aggregate/remove-aggregate',
} as const;

export const ADD_ENTITY_IDENTITY = {
  id: 'LA-AUT-CMD213',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'add-entity',
  description: 'Adds an entity to its aggregate, as its root or a child, with its fields in order and the entities of its aggregate it holds.',
  method: 'POST',
  route: '/api/aggregate/add-entity',
} as const;

export const CHANGE_ENTITY_IDENTITY = {
  id: 'LA-AUT-CMD214',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'change-entity',
  description: 'Changes an entity\'s title, role, description or whether it is stored in its root\'s table, or its fields (the whole list, in order) or the entities it holds (each list whole). Its aggregate does not change.',
  method: 'POST',
  route: '/api/aggregate/change-entity',
} as const;

export const REMOVE_ENTITY_IDENTITY = {
  id: 'LA-AUT-CMD215',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'remove-entity',
  description: 'Removes an entity with its fields, its data model and the links they start. Refused while anything else references them: a command under it, its table, or another entity that holds it.',
  method: 'POST',
  route: '/api/aggregate/remove-entity',
} as const;

export const ADD_INVARIANT_IDENTITY = {
  id: 'LA-AUT-CMD216',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'add-invariant',
  description: 'Adds an invariant to its aggregate: a rule that holds on every change.',
  method: 'POST',
  route: '/api/aggregate/add-invariant',
} as const;

export const CHANGE_INVARIANT_IDENTITY = {
  id: 'LA-AUT-CMD217',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'change-invariant',
  description: 'Changes an invariant\'s title or statement. Its aggregate does not change.',
  method: 'POST',
  route: '/api/aggregate/change-invariant',
} as const;

export const REMOVE_INVARIANT_IDENTITY = {
  id: 'LA-AUT-CMD218',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'remove-invariant',
  description: 'Removes an invariant with its rule and its test, and the links they start. Refused while anything else references them, such as a table key it names.',
  method: 'POST',
  route: '/api/aggregate/remove-invariant',
} as const;

export const ADD_DATA_MODEL_IDENTITY = {
  id: 'LA-AUT-CMD219',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'add-data-model',
  description: 'Adds the data model of an entity of the aggregate: its name in code and its file, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/aggregate/add-data-model',
} as const;

export const CHANGE_DATA_MODEL_IDENTITY = {
  id: 'LA-AUT-CMD220',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'change-data-model',
  description: 'Changes a data model\'s title or file, or the standard rules it meets or the packages it uses (each list whole). Its entity does not change.',
  method: 'POST',
  route: '/api/aggregate/change-data-model',
} as const;

export const REMOVE_DATA_MODEL_IDENTITY = {
  id: 'LA-AUT-CMD221',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'remove-data-model',
  description: 'Removes a data model with the links it starts and the packages it uses. Refused while anything else references it.',
  method: 'POST',
  route: '/api/aggregate/remove-data-model',
} as const;

export const ADD_INVARIANT_TEST_IDENTITY = {
  id: 'LA-AUT-CMD222',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'add-invariant-test',
  description: 'Adds the test of an invariant, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/aggregate/add-invariant-test',
} as const;

export const CHANGE_INVARIANT_TEST_IDENTITY = {
  id: 'LA-AUT-CMD223',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'change-invariant-test',
  description: 'Changes what an invariant test says, or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/aggregate/change-invariant-test',
} as const;

export const REMOVE_INVARIANT_TEST_IDENTITY = {
  id: 'LA-AUT-CMD224',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'remove-invariant-test',
  description: 'Removes an invariant test with the links it starts. Refused while anything else references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/aggregate/remove-invariant-test',
} as const;

export const ADD_RULE_IDENTITY = {
  id: 'LA-AUT-CMD225',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'add-rule',
  description: 'Adds the rule that enforces an invariant of the aggregate: its name in code, the name its refusal carries, and its file, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/aggregate/add-rule',
} as const;

export const CHANGE_RULE_IDENTITY = {
  id: 'LA-AUT-CMD226',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'change-rule',
  description: 'Changes a rule\'s title or file, or the standard rules it meets or the packages it uses (each list whole). Its invariant does not change.',
  method: 'POST',
  route: '/api/aggregate/change-rule',
} as const;

export const REMOVE_RULE_IDENTITY = {
  id: 'LA-AUT-CMD227',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'remove-rule',
  description: 'Removes a rule with the links it starts and the packages it uses, so its invariant is no longer built. Refused while anything else references it.',
  method: 'POST',
  route: '/api/aggregate/remove-rule',
} as const;

export const MOVE_AGGREGATE_IDENTITY = {
  id: 'LA-AUT-CMD387',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'move-aggregate',
  description: 'Moves an aggregate, with everything under it, to another domain of its product: it and each record under it take the new domain\'s ID in place of the old one\'s, and every record that names one of them names the new ID. Refused for a domain of another product, or a new ID another record has.',
  method: 'POST',
  route: '/api/aggregate/move-aggregate',
} as const;
