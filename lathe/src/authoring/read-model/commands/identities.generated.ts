// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_READ_MODEL_IDENTITY = {
  id: 'LA-AUT-CMD285',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'add-read-model',
  description: 'Adds a read model to its domain, with its fields in order, the aggregates it reads, the domain services its projection calls and the events that feed it.',
  method: 'POST',
  route: '/api/read-model/add-read-model',
} as const;

export const CHANGE_READ_MODEL_IDENTITY = {
  id: 'LA-AUT-CMD286',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'change-read-model',
  description: 'Changes a read model\'s title or description, its fields (the whole list, in order), or the aggregates it reads, the domain services it calls or the events that feed it (each the whole list). Its domain never changes.',
  method: 'POST',
  route: '/api/read-model/change-read-model',
} as const;

export const REMOVE_READ_MODEL_IDENTITY = {
  id: 'LA-AUT-CMD287',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'remove-read-model',
  description: 'Removes a read model whole: its fields, queries with their handlers and its projection, and the links they start. Refused while anything outside it references what is in it, such as its table or a flow step that invokes a query.',
  method: 'POST',
  route: '/api/read-model/remove-read-model',
} as const;

export const ADD_QUERY_IDENTITY = {
  id: 'LA-AUT-CMD288',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'add-query',
  description: 'Adds a query to the read model it reads, with the specifications it selects by and the domain services it calls.',
  method: 'POST',
  route: '/api/read-model/add-query',
} as const;

export const CHANGE_QUERY_IDENTITY = {
  id: 'LA-AUT-CMD289',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'change-query',
  description: 'Changes a query\'s title or description, or the specifications it selects by or domain services it calls (each the whole list). Its read model never changes.',
  method: 'POST',
  route: '/api/read-model/change-query',
} as const;

export const REMOVE_QUERY_IDENTITY = {
  id: 'LA-AUT-CMD290',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'remove-query',
  description: 'Removes a query with its handler and the links they start. Refused while anything else references them, such as a flow step that invokes it or its endpoint.',
  method: 'POST',
  route: '/api/read-model/remove-query',
} as const;

export const ADD_PROJECTION_IDENTITY = {
  id: 'LA-AUT-CMD291',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'add-projection',
  description: 'Adds the projection that fills a read model, its one piece of code, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/read-model/add-projection',
} as const;

export const CHANGE_PROJECTION_IDENTITY = {
  id: 'LA-AUT-CMD292',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'change-projection',
  description: 'Changes a projection\'s title, file or description, or the standard rules it meets or packages it uses (each the whole list).',
  method: 'POST',
  route: '/api/read-model/change-projection',
} as const;

export const REMOVE_PROJECTION_IDENTITY = {
  id: 'LA-AUT-CMD293',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'remove-projection',
  description: 'Removes a read model\'s projection with the links it starts and the packages it uses. Refused while anything references it.',
  method: 'POST',
  route: '/api/read-model/remove-projection',
} as const;

export const ADD_QUERY_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD294',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'add-query-handler',
  description: 'Adds the handler that answers a query, its one piece of code, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/read-model/add-query-handler',
} as const;

export const CHANGE_QUERY_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD295',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'change-query-handler',
  description: 'Changes a query handler\'s title, file or description, or the standard rules it meets or packages it uses (each the whole list).',
  method: 'POST',
  route: '/api/read-model/change-query-handler',
} as const;

export const REMOVE_QUERY_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD296',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'remove-query-handler',
  description: 'Removes a query\'s handler with the links it starts and the packages it uses. Refused while anything references it.',
  method: 'POST',
  route: '/api/read-model/remove-query-handler',
} as const;

export const ADD_READER_IDENTITY = {
  id: 'LA-AUT-CMD297',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'add-reader',
  description: 'Adds a read model\'s reader, the one way its query handlers read its table, with the data store it reads the table in, the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/read-model/add-reader',
} as const;

export const CHANGE_READER_IDENTITY = {
  id: 'LA-AUT-CMD298',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'change-reader',
  description: 'Changes a reader\'s title, file or description, the data store it reads in (null clears it), or the standard rules it meets or packages it uses (each the whole list).',
  method: 'POST',
  route: '/api/read-model/change-reader',
} as const;

export const REMOVE_READER_IDENTITY = {
  id: 'LA-AUT-CMD299',
  slice: { aggregate: 'LA-AUT-A10', name: 'read-model' },
  name: 'remove-reader',
  description: 'Removes a read model\'s reader with the links it starts and the packages it uses. Refused while anything references it.',
  method: 'POST',
  route: '/api/read-model/remove-reader',
} as const;
