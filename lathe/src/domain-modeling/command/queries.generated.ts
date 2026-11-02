// Generated from data/ by `npm run generate`. Do not edit.

export const GET_COMMAND_IDENTITY = {
  id: 'LA-MOD-QRY159',
  slice: { aggregate: 'LA-MOD-A8', name: 'command' },
  name: 'get-command',
  description: 'Reads a command whole as its readers read it, by its ID or the ID of any record in it: the record asked for and its kind, the command\'s own details, the events it raises, the specifications it checks and the domain services it calls, its handler, its policies with the event each hears, their event handlers and tests, and the endpoints that expose it.',
  method: 'GET',
  route: '/api/command/get-command',
} as const;

export const LIST_COMMANDS_IDENTITY = {
  id: 'LA-MOD-QRY160',
  slice: { aggregate: 'LA-MOD-A8', name: 'command' },
  name: 'list-commands',
  description: 'Lists the commands that change an entity, by ID, with their titles.',
  method: 'GET',
  route: '/api/command/list-commands',
} as const;

export const NEXT_COMMAND_ID_IDENTITY = {
  id: 'LA-MOD-QRY161',
  slice: { aggregate: 'LA-MOD-A8', name: 'command' },
  name: 'next-id',
  description: 'The next free ID for a command (under an entity), a command handler or policy (under a command), or an event handler or policy test (under a policy): one past the highest in use.',
  method: 'GET',
  route: '/api/command/next-id',
} as const;
