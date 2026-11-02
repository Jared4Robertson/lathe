// Generated from data/ by `npm run generate`. Do not edit.

export const GET_DOMAIN_EVENT_IDENTITY = {
  id: 'LA-MOD-QRY155',
  slice: { aggregate: 'LA-MOD-A7', name: 'domain-event' },
  name: 'get-domain-event',
  description: 'Reads a domain event whole as its readers read it, by its ID or its event type\'s: the record asked for and its kind, the event\'s own details, the fields it carries in order, its event type with the standard rules it meets and the packages it uses, and the commands that raise it and the policies that hear it.',
  method: 'GET',
  route: '/api/domain-event/get-domain-event',
} as const;

export const LIST_DOMAIN_EVENTS_IDENTITY = {
  id: 'LA-MOD-QRY156',
  slice: { aggregate: 'LA-MOD-A7', name: 'domain-event' },
  name: 'list-domain-events',
  description: 'Lists the domain events that happen to an aggregate, by ID, with their titles.',
  method: 'GET',
  route: '/api/domain-event/list-domain-events',
} as const;

export const NEXT_DOMAIN_EVENT_ID_IDENTITY = {
  id: 'LA-MOD-QRY157',
  slice: { aggregate: 'LA-MOD-A7', name: 'domain-event' },
  name: 'next-id',
  description: 'The next free ID for a domain event (under an aggregate) or its event type (under the event): one past the highest in use.',
  method: 'GET',
  route: '/api/domain-event/next-id',
} as const;
