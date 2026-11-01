// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_STORAGE_REQUIREMENT_IDENTITY = {
  id: 'LA-AUT-CMD360',
  slice: { aggregate: 'LA-AUT-A22', name: 'storage-requirement' },
  name: 'add-storage-requirement',
  description: 'Adds a storage requirement under the one aggregate or read model whose data it is about (exactly one of aggregate_id and read_model_id): what of it must be kept, and how well.',
  method: 'POST',
  route: '/api/storage-requirement/add-storage-requirement',
} as const;

export const CHANGE_STORAGE_REQUIREMENT_IDENTITY = {
  id: 'LA-AUT-CMD361',
  slice: { aggregate: 'LA-AUT-A22', name: 'storage-requirement' },
  name: 'change-storage-requirement',
  description: 'Changes a storage requirement\'s title or statement. The aggregate or read model it is about never changes: remove it and add it again under another.',
  method: 'POST',
  route: '/api/storage-requirement/change-storage-requirement',
} as const;

export const REMOVE_STORAGE_REQUIREMENT_IDENTITY = {
  id: 'LA-AUT-CMD362',
  slice: { aggregate: 'LA-AUT-A22', name: 'storage-requirement' },
  name: 'remove-storage-requirement',
  description: 'Removes a storage requirement whole: its storage requirement tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/storage-requirement/remove-storage-requirement',
} as const;

export const ADD_STORAGE_REQUIREMENT_TEST_IDENTITY = {
  id: 'LA-AUT-CMD363',
  slice: { aggregate: 'LA-AUT-A22', name: 'storage-requirement' },
  name: 'add-storage-requirement-test',
  description: 'Adds a storage requirement test under its storage requirement, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/storage-requirement/add-storage-requirement-test',
} as const;

export const CHANGE_STORAGE_REQUIREMENT_TEST_IDENTITY = {
  id: 'LA-AUT-CMD364',
  slice: { aggregate: 'LA-AUT-A22', name: 'storage-requirement' },
  name: 'change-storage-requirement-test',
  description: 'Changes a storage requirement test\'s way of running or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/storage-requirement/change-storage-requirement-test',
} as const;

export const REMOVE_STORAGE_REQUIREMENT_TEST_IDENTITY = {
  id: 'LA-AUT-CMD365',
  slice: { aggregate: 'LA-AUT-A22', name: 'storage-requirement' },
  name: 'remove-storage-requirement-test',
  description: 'Removes a storage requirement test with the links it starts. Refused while anything references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/storage-requirement/remove-storage-requirement-test',
} as const;
