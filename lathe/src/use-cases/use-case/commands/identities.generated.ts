// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_USE_CASE_IDENTITY = {
  id: 'LA-UCS-CMD100',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'add-use-case',
  description: 'Adds a use case under a capability, with its result (the command or query it exists for) and its actors in order, the main actor first.',
  method: 'POST',
  route: '/api/use-case/add-use-case',
} as const;

export const CHANGE_USE_CASE_IDENTITY = {
  id: 'LA-UCS-CMD101',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'change-use-case',
  description: 'Changes a use case\'s title, goal, result or notes, or its actors (the whole list, in order). Its capability changes only by Move a use case.',
  method: 'POST',
  route: '/api/use-case/change-use-case',
} as const;

export const MOVE_USE_CASE_IDENTITY = {
  id: 'LA-UCS-CMD102',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'move-use-case',
  description: 'Moves a use case, with everything in it, under another capability of its product: under another domain\'s, it and everything in it take that domain\'s ID in place of the old one\'s, and every record that names one of them names the new ID.',
  method: 'POST',
  route: '/api/use-case/move-use-case',
} as const;

export const REMOVE_USE_CASE_IDENTITY = {
  id: 'LA-UCS-CMD103',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'remove-use-case',
  description: 'Removes a use case whole: its actors, requirements, flows, steps, tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/use-case/remove-use-case',
} as const;

export const ADD_UC_REQUIREMENT_IDENTITY = {
  id: 'LA-UCS-CMD104',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'add-uc-requirement',
  description: 'Adds a UC requirement to its use case.',
  method: 'POST',
  route: '/api/use-case/add-uc-requirement',
} as const;

export const CHANGE_UC_REQUIREMENT_IDENTITY = {
  id: 'LA-UCS-CMD105',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'change-uc-requirement',
  description: 'Changes a UC requirement\'s title, statement or group.',
  method: 'POST',
  route: '/api/use-case/change-uc-requirement',
} as const;

export const REMOVE_UC_REQUIREMENT_IDENTITY = {
  id: 'LA-UCS-CMD106',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'remove-uc-requirement',
  description: 'Removes a UC requirement with its use case tests and the links they start. Refused while a step fulfills it, or anything else references it or its tests.',
  method: 'POST',
  route: '/api/use-case/remove-uc-requirement',
} as const;

export const ADD_FLOW_IDENTITY = {
  id: 'LA-UCS-CMD107',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'add-flow',
  description: 'Adds its use case\'s one flow: its ID is the use case\'s and FL.',
  method: 'POST',
  route: '/api/use-case/add-flow',
} as const;

export const CHANGE_FLOW_IDENTITY = {
  id: 'LA-UCS-CMD108',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'change-flow',
  description: 'Changes a flow\'s title, which is its use case\'s.',
  method: 'POST',
  route: '/api/use-case/change-flow',
} as const;

export const REMOVE_FLOW_IDENTITY = {
  id: 'LA-UCS-CMD109',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'remove-flow',
  description: 'Removes a flow with its steps, its flow test and the links they start. Refused while anything else references them.',
  method: 'POST',
  route: '/api/use-case/remove-flow',
} as const;

export const ADD_FLOW_STEP_IDENTITY = {
  id: 'LA-UCS-CMD110',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'add-flow-step',
  description: 'Adds a step to its flow, on a path at a position, with the interface it is a variant of if only one does it, the requirements it fulfills, what it invokes and the integrations it exchanges with.',
  method: 'POST',
  route: '/api/use-case/add-flow-step',
} as const;

export const CHANGE_FLOW_STEP_IDENTITY = {
  id: 'LA-UCS-CMD111',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'change-flow-step',
  description: 'Changes a step\'s title or the interface it is a variant of (null makes it every interface\'s), or its links: a list given replaces the list, null clears what it invokes. Its path and position change only by Move a flow step.',
  method: 'POST',
  route: '/api/use-case/change-flow-step',
} as const;

export const REMOVE_FLOW_STEP_IDENTITY = {
  id: 'LA-UCS-CMD112',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'remove-flow-step',
  description: 'Removes a flow step with the links it starts. Refused while anything else references it.',
  method: 'POST',
  route: '/api/use-case/remove-flow-step',
} as const;

export const ADD_USE_CASE_TEST_IDENTITY = {
  id: 'LA-UCS-CMD113',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'add-use-case-test',
  description: 'Adds a use case test under its UC requirement, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/use-case/add-use-case-test',
} as const;

export const CHANGE_USE_CASE_TEST_IDENTITY = {
  id: 'LA-UCS-CMD114',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'change-use-case-test',
  description: 'Changes a use case test\'s way of running or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/use-case/change-use-case-test',
} as const;

export const REMOVE_USE_CASE_TEST_IDENTITY = {
  id: 'LA-UCS-CMD115',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'remove-use-case-test',
  description: 'Removes a use case test with the links it starts. Refused while anything else references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/use-case/remove-use-case-test',
} as const;

export const ADD_FLOW_TEST_IDENTITY = {
  id: 'LA-UCS-CMD116',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'add-flow-test',
  description: 'Adds a flow test under its flow, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/use-case/add-flow-test',
} as const;

export const CHANGE_FLOW_TEST_IDENTITY = {
  id: 'LA-UCS-CMD117',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'change-flow-test',
  description: 'Changes a flow test\'s way of running or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/use-case/change-flow-test',
} as const;

export const REMOVE_FLOW_TEST_IDENTITY = {
  id: 'LA-UCS-CMD118',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'remove-flow-test',
  description: 'Removes a flow test with the links it starts. Refused while anything else references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/use-case/remove-flow-test',
} as const;

export const MOVE_FLOW_STEP_IDENTITY = {
  id: 'LA-UCS-CMD386',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'move-flow-step',
  description: 'Moves a step to another position, on its own path or another, shifting the steps of the old path and the new so each stays numbered 1, 2, 3.',
  method: 'POST',
  route: '/api/use-case/move-flow-step',
} as const;

export const MOVE_UC_REQUIREMENT_IDENTITY = {
  id: 'LA-UCS-CMD396',
  slice: { aggregate: 'LA-UCS-A11', name: 'use-case' },
  name: 'move-uc-requirement',
  description: 'Moves a UC requirement, with its tests, to another use case of its product: it takes the next free number there, its tests the new requirement\'s ID in place of the old one\'s, and every record that names one of them names the new ID. Refused while a step of its use case fulfills it, or for a use case of another product.',
  method: 'POST',
  route: '/api/use-case/move-uc-requirement',
} as const;
