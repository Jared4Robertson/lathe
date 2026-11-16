// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_GENERATED_COMPONENT_IDENTITY = {
  id: 'LA-MOD-CMD406',
  slice: { aggregate: 'LA-MOD-A25', name: 'generated-component' },
  name: 'add-generated-component',
  description: 'Adds a generated component to a business domain: what the product emits for code outside the repo, with the business outcomes it serves.',
  method: 'POST',
  route: '/api/generated-component/add-generated-component',
} as const;

export const CHANGE_GENERATED_COMPONENT_IDENTITY = {
  id: 'LA-MOD-CMD407',
  slice: { aggregate: 'LA-MOD-A25', name: 'generated-component' },
  name: 'change-generated-component',
  description: 'Changes a generated component\'s title or description, or the business outcomes it serves (the whole list). Its domain never changes.',
  method: 'POST',
  route: '/api/generated-component/change-generated-component',
} as const;

export const REMOVE_GENERATED_COMPONENT_IDENTITY = {
  id: 'LA-MOD-CMD408',
  slice: { aggregate: 'LA-MOD-A25', name: 'generated-component' },
  name: 'remove-generated-component',
  description: 'Removes a generated component and the links it starts. Refused while anything references it, such as a guarantee it makes or a pattern whose fixed part it makes.',
  method: 'POST',
  route: '/api/generated-component/remove-generated-component',
} as const;
