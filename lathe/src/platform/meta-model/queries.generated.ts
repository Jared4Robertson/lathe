// Generated from data/ by `npm run generate`. Do not edit.

export const GET_META_MODEL_IDENTITY = {
  id: 'LA-PLT-QRY11',
  slice: { aggregate: 'LA-PLT-RM08', name: 'meta-model' },
  name: 'get-meta-model',
  description: 'Gets the meta model: every kind (Lathe\'s in reading order, then each product\'s own) with its label, stage, parents and ID scope, the six stages, each pair of kinds a relation may link with its words both ways, and each kind\'s fields.',
  method: 'GET',
  route: '/api/meta-model/get-meta-model',
} as const;
