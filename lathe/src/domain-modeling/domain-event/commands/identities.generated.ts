// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_DOMAIN_EVENT_IDENTITY = {
  id: 'LA-MOD-CMD230',
  slice: { aggregate: 'LA-MOD-A7', name: 'domain-event' },
  name: 'add-domain-event',
  description: 'Adds a domain event to the aggregate it happens to, with the fields it carries, in order.',
  method: 'POST',
  route: '/api/domain-event/add-domain-event',
} as const;

export const CHANGE_DOMAIN_EVENT_IDENTITY = {
  id: 'LA-MOD-CMD231',
  slice: { aggregate: 'LA-MOD-A7', name: 'domain-event' },
  name: 'change-domain-event',
  description: 'Changes a domain event\'s title, description or whether it is published, or its fields (the whole list, in order). The aggregate it happens to does not change.',
  method: 'POST',
  route: '/api/domain-event/change-domain-event',
} as const;

export const REMOVE_DOMAIN_EVENT_IDENTITY = {
  id: 'LA-MOD-CMD232',
  slice: { aggregate: 'LA-MOD-A7', name: 'domain-event' },
  name: 'remove-domain-event',
  description: 'Removes a domain event whole: its fields, its event type and the links it starts. Refused while anything else references it: a command that raises it, a policy that hears it or a read model it feeds.',
  method: 'POST',
  route: '/api/domain-event/remove-domain-event',
} as const;

export const ADD_EVENT_TYPE_IDENTITY = {
  id: 'LA-MOD-CMD233',
  slice: { aggregate: 'LA-MOD-A7', name: 'domain-event' },
  name: 'add-event-type',
  description: 'Adds a domain event\'s shape in code: its name, how it is delivered and its file, with the standard rules it meets, the packages it uses and its helper files. An event has one event type.',
  method: 'POST',
  route: '/api/domain-event/add-event-type',
} as const;

export const CHANGE_EVENT_TYPE_IDENTITY = {
  id: 'LA-MOD-CMD234',
  slice: { aggregate: 'LA-MOD-A7', name: 'domain-event' },
  name: 'change-event-type',
  description: 'Changes an event type\'s title, delivery or file, or the standard rules it meets, the packages it uses or its helper files (each list whole). Its event does not change.',
  method: 'POST',
  route: '/api/domain-event/change-event-type',
} as const;

export const REMOVE_EVENT_TYPE_IDENTITY = {
  id: 'LA-MOD-CMD235',
  slice: { aggregate: 'LA-MOD-A7', name: 'domain-event' },
  name: 'remove-event-type',
  description: 'Removes an event type with the links it starts, the packages it uses and its helper files. Refused while anything else references it.',
  method: 'POST',
  route: '/api/domain-event/remove-event-type',
} as const;
