// Generated from data/ by `npm run generate`. Do not edit.

export const GET_SERVES_IDENTITY = {
  id: 'LA-TRC-QRY16',
  slice: { aggregate: 'LA-TRC-RM12', name: 'serves' },
  name: 'get-serves',
  description: 'Gets the business outcomes a record serves, and the use cases it serves them through: those of each use case whose capability serves an outcome and that reaches the record. Worked out from the data on every read; none when nothing reaches it.',
  method: 'GET',
  route: '/api/serves/get-serves',
} as const;

export const LIST_SERVES_IDENTITY = {
  id: 'LA-TRC-QRY17',
  slice: { aggregate: 'LA-TRC-RM12', name: 'serves' },
  name: 'list-serves',
  description: 'Lists each record of a product\'s space that serves a business outcome, with its outcomes and the use cases it serves them through, and the aggregates, read models and obligations of its space no outcome reaches. Worked out from the data on every read.',
  method: 'GET',
  route: '/api/serves/list-serves',
} as const;
