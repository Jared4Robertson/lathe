// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_COMMAND_IDENTITY = {
  id: 'LA-AUT-CMD240',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'add-command',
  description: 'Adds a command under the entity it changes, with the events of its aggregate it raises, the specifications it checks and the domain services it calls.',
  method: 'POST',
  route: '/api/command/add-command',
} as const;

export const CHANGE_COMMAND_IDENTITY = {
  id: 'LA-AUT-CMD241',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'change-command',
  description: 'Changes a command\'s title or description, or the events it raises, the specifications it checks or the domain services it calls (each list whole). The entity it changes does not change.',
  method: 'POST',
  route: '/api/command/change-command',
} as const;

export const REMOVE_COMMAND_IDENTITY = {
  id: 'LA-AUT-CMD242',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'remove-command',
  description: 'Removes a command whole: its handler, its policies with their event handlers and tests, and the links they start. Refused while anything outside it references what is in it: a step that invokes it, its endpoint or command-line command.',
  method: 'POST',
  route: '/api/command/remove-command',
} as const;

export const ADD_COMMAND_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD243',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'add-command-handler',
  description: 'Adds the handler that carries out a command: its name in code, its file and what it does, with the standard rules it meets and the packages it uses. A command has one handler.',
  method: 'POST',
  route: '/api/command/add-command-handler',
} as const;

export const CHANGE_COMMAND_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD244',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'change-command-handler',
  description: 'Changes a command handler\'s title, file or description, or the standard rules it meets or the packages it uses (each list whole). Its command does not change.',
  method: 'POST',
  route: '/api/command/change-command-handler',
} as const;

export const REMOVE_COMMAND_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD245',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'remove-command-handler',
  description: 'Removes a command handler with the links it starts and the packages it uses. Refused while anything else references it.',
  method: 'POST',
  route: '/api/command/remove-command-handler',
} as const;

export const ADD_POLICY_IDENTITY = {
  id: 'LA-AUT-CMD246',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'add-policy',
  description: 'Adds a policy under the command it sends, with the one event it hears: its own domain\'s, or another domain\'s published one.',
  method: 'POST',
  route: '/api/command/add-policy',
} as const;

export const CHANGE_POLICY_IDENTITY = {
  id: 'LA-AUT-CMD247',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'change-policy',
  description: 'Changes a policy\'s title or statement, or the event it hears; null clears the event. The command it sends does not change.',
  method: 'POST',
  route: '/api/command/change-policy',
} as const;

export const REMOVE_POLICY_IDENTITY = {
  id: 'LA-AUT-CMD248',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'remove-policy',
  description: 'Removes a policy with its event handler and test and the links they start. Refused while anything else references them.',
  method: 'POST',
  route: '/api/command/remove-policy',
} as const;

export const ADD_EVENT_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD249',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'add-event-handler',
  description: 'Adds the handler that carries out a policy: its name in code, its file and what it does, with the standard rules it meets and the packages it uses. A policy has one event handler.',
  method: 'POST',
  route: '/api/command/add-event-handler',
} as const;

export const CHANGE_EVENT_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD250',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'change-event-handler',
  description: 'Changes an event handler\'s title, file or description, or the standard rules it meets or the packages it uses (each list whole). Its policy does not change.',
  method: 'POST',
  route: '/api/command/change-event-handler',
} as const;

export const REMOVE_EVENT_HANDLER_IDENTITY = {
  id: 'LA-AUT-CMD251',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'remove-event-handler',
  description: 'Removes an event handler with the links it starts and the packages it uses. Refused while anything else references it.',
  method: 'POST',
  route: '/api/command/remove-event-handler',
} as const;

export const ADD_POLICY_TEST_IDENTITY = {
  id: 'LA-AUT-CMD252',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'add-policy-test',
  description: 'Adds the test of a policy, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/command/add-policy-test',
} as const;

export const CHANGE_POLICY_TEST_IDENTITY = {
  id: 'LA-AUT-CMD253',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'change-policy-test',
  description: 'Changes a policy test\'s way of running or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/command/change-policy-test',
} as const;

export const REMOVE_POLICY_TEST_IDENTITY = {
  id: 'LA-AUT-CMD254',
  slice: { aggregate: 'LA-AUT-A8', name: 'command' },
  name: 'remove-policy-test',
  description: 'Removes a policy test with the links it starts. Refused while anything else references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/command/remove-policy-test',
} as const;
