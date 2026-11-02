// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_TEST_DATA_SET_IDENTITY = {
  id: 'LA-TST-CMD185',
  slice: { aggregate: 'LA-TST-A17', name: 'test-data-set' },
  name: 'add-test-data-set',
  description: 'Adds a test data set to the domain whose tests it serves: where it runs, what it starts with, how to prepare and reset it, and the file that builds it.',
  method: 'POST',
  route: '/api/test-data-set/add-test-data-set',
} as const;

export const CHANGE_TEST_DATA_SET_IDENTITY = {
  id: 'LA-TST-CMD186',
  slice: { aggregate: 'LA-TST-A17', name: 'test-data-set' },
  name: 'change-test-data-set',
  description: 'Changes a test data set\'s details. Its domain never changes.',
  method: 'POST',
  route: '/api/test-data-set/change-test-data-set',
} as const;

export const REMOVE_TEST_DATA_SET_IDENTITY = {
  id: 'LA-TST-CMD187',
  slice: { aggregate: 'LA-TST-A17', name: 'test-data-set' },
  name: 'remove-test-data-set',
  description: 'Removes a test data set. Refused while a test starts from it or anything else references it.',
  method: 'POST',
  route: '/api/test-data-set/remove-test-data-set',
} as const;

export const MOVE_TEST_DATA_SET_IDENTITY = {
  id: 'LA-TST-CMD393',
  slice: { aggregate: 'LA-TST-A17', name: 'test-data-set' },
  name: 'move-test-data-set',
  description: 'Moves a test data set to another domain of its product: it takes the new domain\'s ID in place of the old one\'s, and every record that names it names the new ID. Refused for a domain of another product, or a new ID another record has.',
  method: 'POST',
  route: '/api/test-data-set/move-test-data-set',
} as const;
