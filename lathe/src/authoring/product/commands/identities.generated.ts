// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_PRODUCT_IDENTITY = {
  id: 'LA-AUT-CMD120',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'add-product',
  description: 'Adds a product, the root of a set of specifications, with its roles.',
  method: 'POST',
  route: '/api/product/add-product',
} as const;

export const CHANGE_PRODUCT_IDENTITY = {
  id: 'LA-AUT-CMD121',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'change-product',
  description: 'Changes a product\'s title, description, icon, color or notes, or its roles (the whole list).',
  method: 'POST',
  route: '/api/product/change-product',
} as const;

export const DECLARE_PRODUCT_KIND_IDENTITY = {
  id: 'LA-AUT-CMD122',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'declare-product-kind',
  description: 'Declares a kind of the product\'s own, with its fields in order: the next load gives it a table of its own.',
  method: 'POST',
  route: '/api/product/declare-product-kind',
} as const;

export const CHANGE_PRODUCT_KIND_IDENTITY = {
  id: 'LA-AUT-CMD123',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'change-product-kind',
  description: 'Changes a product kind\'s label, description, parent kind, stage, obligation, ID pattern, example or title form, or its fields (the whole list, in order). Refused when a record of the kind no longer fits it.',
  method: 'POST',
  route: '/api/product/change-product-kind',
} as const;

export const REMOVE_PRODUCT_KIND_IDENTITY = {
  id: 'LA-AUT-CMD124',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'remove-product-kind',
  description: 'Removes a product kind\'s declaration with its fields. Refused while the product has records of the kind, or a relation or kind names it.',
  method: 'POST',
  route: '/api/product/remove-product-kind',
} as const;

export const DECLARE_PRODUCT_RELATION_IDENTITY = {
  id: 'LA-AUT-CMD125',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'declare-product-relation',
  description: 'Declares a pair of kinds a relation of the product\'s own may link: a new name gets its own link table, a name Lathe has gains the pair.',
  method: 'POST',
  route: '/api/product/declare-product-relation',
} as const;

export const CHANGE_PRODUCT_RELATION_IDENTITY = {
  id: 'LA-AUT-CMD126',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'change-product-relation',
  description: 'Changes a product relation pair\'s role, labels or description; its name and kinds are its key.',
  method: 'POST',
  route: '/api/product/change-product-relation',
} as const;

export const REMOVE_PRODUCT_RELATION_IDENTITY = {
  id: 'LA-AUT-CMD127',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'remove-product-relation',
  description: 'Removes a product relation pair. Refused while a link of the pair is left.',
  method: 'POST',
  route: '/api/product/remove-product-relation',
} as const;

export const ADD_QUESTION_IDENTITY = {
  id: 'LA-AUT-CMD128',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'add-question',
  description: 'Adds an open question under its product or one of its domains, with the role that decides it and the records it is about.',
  method: 'POST',
  route: '/api/product/add-question',
} as const;

export const CHANGE_QUESTION_IDENTITY = {
  id: 'LA-AUT-CMD129',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'change-question',
  description: 'Changes an open question\'s title, owner or description, or the records it is about (the whole list). Its product or domain changes only by Move an open question.',
  method: 'POST',
  route: '/api/product/change-question',
} as const;

export const MOVE_QUESTION_IDENTITY = {
  id: 'LA-AUT-CMD130',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'move-question',
  description: 'Moves an open question between its product and one of the product\'s domains, or from one domain to another of the same product.',
  method: 'POST',
  route: '/api/product/move-question',
} as const;

export const REMOVE_QUESTION_IDENTITY = {
  id: 'LA-AUT-CMD131',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'remove-question',
  description: 'Removes an open question with what it is about, once it is decided and its answer is written into the records it affects.',
  method: 'POST',
  route: '/api/product/remove-question',
} as const;

export const ADD_INTERFACE_IDENTITY = {
  id: 'LA-AUT-CMD132',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'add-interface',
  description: 'Adds an interface of a product: a way it is used, such as an app a person works in, calls other programs make, or a command line, with the roles that use it and the use cases it offers.',
  method: 'POST',
  route: '/api/product/add-interface',
} as const;

export const CHANGE_INTERFACE_IDENTITY = {
  id: 'LA-AUT-CMD133',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'change-interface',
  description: 'Changes an interface\'s title, kind, description, whether it is public, the roles that use it or the use cases it offers (each list replaced whole).',
  method: 'POST',
  route: '/api/product/change-interface',
} as const;

export const REMOVE_INTERFACE_IDENTITY = {
  id: 'LA-AUT-CMD134',
  slice: { aggregate: 'LA-AUT-A1', name: 'product' },
  name: 'remove-interface',
  description: 'Removes an interface with its roles and the use cases it offers. Refused while a variant step or a view names it, or anything else references it.',
  method: 'POST',
  route: '/api/product/remove-interface',
} as const;
