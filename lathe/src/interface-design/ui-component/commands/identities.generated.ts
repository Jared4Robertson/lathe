// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_UI_COMPONENT_IDENTITY = {
  id: 'LA-IXD-CMD345',
  slice: { aggregate: 'LA-IXD-A15', name: 'ui-component' },
  name: 'add-ui-component',
  description: 'Adds a UI component: its name in code and its file, with the views it renders, the view requirements it builds, the standard rules it meets, the packages it uses and its helper files. It has no owner; its product follows from its ID.',
  method: 'POST',
  route: '/api/ui-component/add-ui-component',
} as const;

export const CHANGE_UI_COMPONENT_IDENTITY = {
  id: 'LA-IXD-CMD346',
  slice: { aggregate: 'LA-IXD-A15', name: 'ui-component' },
  name: 'change-ui-component',
  description: 'Changes a UI component\'s title, file or description, or the views it renders, the view requirements it builds, the standard rules it meets, the packages it uses or its helper files (each list whole).',
  method: 'POST',
  route: '/api/ui-component/change-ui-component',
} as const;

export const REMOVE_UI_COMPONENT_IDENTITY = {
  id: 'LA-IXD-CMD347',
  slice: { aggregate: 'LA-IXD-A15', name: 'ui-component' },
  name: 'remove-ui-component',
  description: 'Removes a UI component whole: the links it starts, the packages it uses and its helper files. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/ui-component/remove-ui-component',
} as const;
