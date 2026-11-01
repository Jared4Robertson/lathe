// Generated from data/ by `npm run generate`. Do not edit.

export const GET_AGGREGATE_IDENTITY = {
  id: 'LA-AUT-QRY150',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'get-aggregate',
  description: 'Reads an aggregate whole as its readers read it, by its ID or the ID of any record in it: the record asked for and its kind, the aggregate\'s own details, its entities (the root first) with their fields, the entities they hold, their data models, commands and tables, its invariants with their rules and tests, and the domain events that happen to it with what raises and hears them.',
  method: 'GET',
  route: '/api/aggregate/get-aggregate',
} as const;

export const LIST_AGGREGATES_IDENTITY = {
  id: 'LA-AUT-QRY151',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'list-aggregates',
  description: 'Lists the aggregates of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/aggregate/list-aggregates',
} as const;

export const NEXT_AGGREGATE_ID_IDENTITY = {
  id: 'LA-AUT-QRY152',
  slice: { aggregate: 'LA-AUT-A6', name: 'aggregate' },
  name: 'next-id',
  description: 'The next free ID for an aggregate (under a domain), an entity or invariant (under an aggregate), a data model (under an entity), or a rule or invariant test (under an invariant): one past the highest in use.',
  method: 'GET',
  route: '/api/aggregate/next-id',
} as const;
