// Generated from data/ by `npm run generate`. Do not edit.

export const SET_LIMITS_IDENTITY = {
  id: 'LA-CHK-CMD04',
  slice: { aggregate: 'LA-CHK-A2', name: 'product-setting' },
  name: 'set-limits',
  description: 'Sets a product\'s settings row: the most children of one kind a record should hold, and the most entities an aggregate should hold. A product without the row takes the defaults, 15 and 7.',
  method: 'POST',
  route: '/api/product-setting/set-limits',
} as const;

export const SET_TECHNOLOGY_WORDS_IDENTITY = {
  id: 'LA-CHK-CMD05',
  slice: { aggregate: 'LA-CHK-A2', name: 'product-setting' },
  name: 'set-technology-words',
  description: 'Sets the words, besides Lathe\'s own, that name technology in the product\'s essential records, keeping its limits; the first time, adds its settings row with the default limits.',
  method: 'POST',
  route: '/api/product-setting/set-technology-words',
} as const;
