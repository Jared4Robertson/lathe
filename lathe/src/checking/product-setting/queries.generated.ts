// Generated from data/ by `npm run generate`. Do not edit.

export const GET_LIMITS_IDENTITY = {
  id: 'LA-CHK-QRY12',
  slice: { aggregate: 'LA-CHK-A2', name: 'product-setting' },
  name: 'get-limits',
  description: 'Reads a product\'s limits: the most children of one kind a record should hold and the most entities an aggregate should hold, its own or the defaults, and whether its check is strict, with the warnings it accepts.',
  method: 'GET',
  route: '/api/product-setting/get-limits',
} as const;
