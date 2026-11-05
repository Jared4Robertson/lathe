// Generated from data/ by `npm run generate`. Do not edit.

export const SET_LIMITS_IDENTITY = {
  id: 'LA-CHK-CMD04',
  slice: { aggregate: 'LA-CHK-A2', name: 'product-setting' },
  name: 'set-limits',
  description: 'Sets a product\'s settings: the most children of one kind a record should hold, and the most entities an aggregate should hold. A product without settings takes the defaults, 15 and 7.',
  method: 'POST',
  route: '/api/product-setting/set-limits',
} as const;

export const SET_TECHNOLOGY_WORDS_IDENTITY = {
  id: 'LA-CHK-CMD05',
  slice: { aggregate: 'LA-CHK-A2', name: 'product-setting' },
  name: 'set-technology-words',
  description: 'Sets the words, besides Lathe\'s own, that name technology in the product\'s essential records, keeping its limits; the first time, adds its settings with the default limits.',
  method: 'POST',
  route: '/api/product-setting/set-technology-words',
} as const;

export const SET_STRICT_CHECK_IDENTITY = {
  id: 'LA-CHK-CMD06',
  slice: { aggregate: 'LA-CHK-A2', name: 'product-setting' },
  name: 'set-strict-check',
  description: 'Sets whether the product\'s check is strict, so that any warning fails it as an error does, and the warnings it accepts while zero cannot be reached yet, keeping its limits and technology words. Refused when the accepted count is above the warnings the product has now, or given for a check that is not strict.',
  method: 'POST',
  route: '/api/product-setting/set-strict-check',
} as const;
