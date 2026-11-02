// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_JOURNEY_IDENTITY = {
  id: 'LA-PRD-CMD376',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'add-journey',
  description: 'Adds a journey under its product, with its trigger, its result and the business outcomes it serves.',
  method: 'POST',
  route: '/api/journey/add-journey',
} as const;

export const CHANGE_JOURNEY_IDENTITY = {
  id: 'LA-PRD-CMD377',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'change-journey',
  description: 'Changes a journey\'s title, trigger, result or notes, or the business outcomes it serves (the whole list). Its product stays.',
  method: 'POST',
  route: '/api/journey/change-journey',
} as const;

export const REMOVE_JOURNEY_IDENTITY = {
  id: 'LA-PRD-CMD378',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'remove-journey',
  description: 'Removes a journey whole: its steps, its journey test and the links they start, never the use cases and policies its steps carry out. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/journey/remove-journey',
} as const;

export const ADD_JOURNEY_STEP_IDENTITY = {
  id: 'LA-PRD-CMD379',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'add-journey-step',
  description: 'Adds a step to its journey, on a path at a position, with the use case or policy it carries out, or none yet.',
  method: 'POST',
  route: '/api/journey/add-journey-step',
} as const;

export const CHANGE_JOURNEY_STEP_IDENTITY = {
  id: 'LA-PRD-CMD380',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'change-journey-step',
  description: 'Changes a step\'s title, or the use case or policy it carries out (null clears it). Its path and position change only by Move a journey step.',
  method: 'POST',
  route: '/api/journey/change-journey-step',
} as const;

export const MOVE_JOURNEY_STEP_IDENTITY = {
  id: 'LA-PRD-CMD381',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'move-journey-step',
  description: 'Moves a step to another position, on its own path or another, shifting the steps of the old path and the new so each stays numbered 1, 2, 3.',
  method: 'POST',
  route: '/api/journey/move-journey-step',
} as const;

export const REMOVE_JOURNEY_STEP_IDENTITY = {
  id: 'LA-PRD-CMD382',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'remove-journey-step',
  description: 'Removes a step with the link it starts. Refused while anything else references it.',
  method: 'POST',
  route: '/api/journey/remove-journey-step',
} as const;

export const ADD_JOURNEY_TEST_IDENTITY = {
  id: 'LA-PRD-CMD383',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'add-journey-test',
  description: 'Adds the journey test under its journey, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/journey/add-journey-test',
} as const;

export const CHANGE_JOURNEY_TEST_IDENTITY = {
  id: 'LA-PRD-CMD384',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'change-journey-test',
  description: 'Changes a journey test\'s way of running, steps or expected result, or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/journey/change-journey-test',
} as const;

export const REMOVE_JOURNEY_TEST_IDENTITY = {
  id: 'LA-PRD-CMD385',
  slice: { aggregate: 'LA-PRD-A25', name: 'journey' },
  name: 'remove-journey-test',
  description: 'Removes a journey test with the links it starts. Refused while anything else references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/journey/remove-journey-test',
} as const;
