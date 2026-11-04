// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_INTEGRATION_IDENTITY = {
  id: 'LA-IXD-CMD335',
  slice: { aggregate: 'LA-IXD-A14', name: 'integration' },
  name: 'add-integration',
  description: 'Adds an integration: an outside system the product exchanges with, with the use cases of its product it performs on its own. It has no owner; its product follows from its ID.',
  method: 'POST',
  route: '/api/integration/add-integration',
} as const;

export const CHANGE_INTEGRATION_IDENTITY = {
  id: 'LA-IXD-CMD336',
  slice: { aggregate: 'LA-IXD-A14', name: 'integration' },
  name: 'change-integration',
  description: 'Changes an integration\'s title, system or description, or the use cases it performs (the whole list).',
  method: 'POST',
  route: '/api/integration/change-integration',
} as const;

export const REMOVE_INTEGRATION_IDENTITY = {
  id: 'LA-IXD-CMD337',
  slice: { aggregate: 'LA-IXD-A14', name: 'integration' },
  name: 'remove-integration',
  description: 'Removes an integration whole: its adapter, its integration tests and the links they start, and the use cases it performs. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/integration/remove-integration',
} as const;

export const ADD_ADAPTER_IDENTITY = {
  id: 'LA-IXD-CMD338',
  slice: { aggregate: 'LA-IXD-A14', name: 'integration' },
  name: 'add-adapter',
  description: 'Adds an integration\'s adapter, its one piece of code that talks to the outside system: its name in code and its file, with the standard rules it meets, the packages it uses and its helper files.',
  method: 'POST',
  route: '/api/integration/add-adapter',
} as const;

export const CHANGE_ADAPTER_IDENTITY = {
  id: 'LA-IXD-CMD339',
  slice: { aggregate: 'LA-IXD-A14', name: 'integration' },
  name: 'change-adapter',
  description: 'Changes an adapter\'s title, file or description, or the standard rules it meets, the packages it uses or its helper files (each list whole). Its integration does not change.',
  method: 'POST',
  route: '/api/integration/change-adapter',
} as const;

export const REMOVE_ADAPTER_IDENTITY = {
  id: 'LA-IXD-CMD340',
  slice: { aggregate: 'LA-IXD-A14', name: 'integration' },
  name: 'remove-adapter',
  description: 'Removes an adapter with the links it starts, the packages it uses and its helper files. Refused while anything else references them.',
  method: 'POST',
  route: '/api/integration/remove-adapter',
} as const;

export const ADD_INTEGRATION_TEST_IDENTITY = {
  id: 'LA-IXD-CMD341',
  slice: { aggregate: 'LA-IXD-A14', name: 'integration' },
  name: 'add-integration-test',
  description: 'Adds an integration test under its integration, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/integration/add-integration-test',
} as const;

export const CHANGE_INTEGRATION_TEST_IDENTITY = {
  id: 'LA-IXD-CMD342',
  slice: { aggregate: 'LA-IXD-A14', name: 'integration' },
  name: 'change-integration-test',
  description: 'Changes an integration test\'s way of running or the test data sets it starts from (the whole list). Its integration does not change.',
  method: 'POST',
  route: '/api/integration/change-integration-test',
} as const;

export const REMOVE_INTEGRATION_TEST_IDENTITY = {
  id: 'LA-IXD-CMD343',
  slice: { aggregate: 'LA-IXD-A14', name: 'integration' },
  name: 'remove-integration-test',
  description: 'Removes an integration test with the links it starts. Refused while anything else references them.',
  method: 'POST',
  route: '/api/integration/remove-integration-test',
} as const;
