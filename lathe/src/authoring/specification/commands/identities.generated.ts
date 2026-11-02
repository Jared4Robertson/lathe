// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_SPECIFICATION_IDENTITY = {
  id: 'LA-AUT-CMD260',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'add-specification',
  description: 'Adds a specification, in the domain its ID names, with the aggregates it reads.',
  method: 'POST',
  route: '/api/specification/add-specification',
} as const;

export const CHANGE_SPECIFICATION_IDENTITY = {
  id: 'LA-AUT-CMD261',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'change-specification',
  description: 'Changes a specification\'s title or statement, or the aggregates it reads (the whole list).',
  method: 'POST',
  route: '/api/specification/change-specification',
} as const;

export const REMOVE_SPECIFICATION_IDENTITY = {
  id: 'LA-AUT-CMD262',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'remove-specification',
  description: 'Removes a specification whole: its predicate and test, and the links they start. Refused while anything outside it references what is in it, such as a command that checks it.',
  method: 'POST',
  route: '/api/specification/remove-specification',
} as const;

export const ADD_PREDICATE_IDENTITY = {
  id: 'LA-AUT-CMD263',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'add-predicate',
  description: 'Adds the predicate of a specification, its one piece of code, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/specification/add-predicate',
} as const;

export const CHANGE_PREDICATE_IDENTITY = {
  id: 'LA-AUT-CMD264',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'change-predicate',
  description: 'Changes a predicate\'s title or file, or the standard rules it meets or packages it uses (each the whole list).',
  method: 'POST',
  route: '/api/specification/change-predicate',
} as const;

export const REMOVE_PREDICATE_IDENTITY = {
  id: 'LA-AUT-CMD265',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'remove-predicate',
  description: 'Removes a specification\'s predicate with the links it starts and the packages it uses. Refused while anything references it.',
  method: 'POST',
  route: '/api/specification/remove-predicate',
} as const;

export const ADD_SPECIFICATION_TEST_IDENTITY = {
  id: 'LA-AUT-CMD266',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'add-specification-test',
  description: 'Adds the test of a specification, its one test, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/specification/add-specification-test',
} as const;

export const CHANGE_SPECIFICATION_TEST_IDENTITY = {
  id: 'LA-AUT-CMD267',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'change-specification-test',
  description: 'Changes a specification test\'s way of running or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/specification/change-specification-test',
} as const;

export const REMOVE_SPECIFICATION_TEST_IDENTITY = {
  id: 'LA-AUT-CMD268',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'remove-specification-test',
  description: 'Removes a specification\'s test with the links it starts. Refused while anything references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/specification/remove-specification-test',
} as const;

export const MOVE_SPECIFICATION_IDENTITY = {
  id: 'LA-AUT-CMD392',
  slice: { aggregate: 'LA-AUT-A5', name: 'specification' },
  name: 'move-specification',
  description: 'Moves a specification, with its predicate and test, to another domain of its product: each takes the new domain\'s ID in place of the old one\'s, and every record that names one of them names the new ID. Refused for a domain of another product, or a new ID another record has.',
  method: 'POST',
  route: '/api/specification/move-specification',
} as const;
