// Generated from data/ by `npm run generate`. Do not edit.

export const SET_LIMITS_IDENTITY = {
  id: 'LA-CHK-CMD04',
  slice: { aggregate: 'LA-CHK-A2', name: 'product-setting' },
  name: 'set-limits',
  description: 'Sets a product\'s settings row: the most children of one kind a record should hold, and the most entities an aggregate should hold. A product without the row takes the defaults, 15 and 7.',
  method: 'POST',
  route: '/api/product-setting/set-limits',
} as const;
