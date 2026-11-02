// Generated from data/ by `npm run generate`. Do not edit.

export const GET_DOMAIN_IDENTITY = {
  id: 'LA-MOD-QRY130',
  slice: { aggregate: 'LA-MOD-A4', name: 'domain' },
  name: 'get-domain',
  description: 'Reads a domain whole as its readers read it, by its ID or the ID of any record in it: the record asked for and its kind, the domain\'s own details, its capabilities in order with the outcomes they serve and their use cases, its terms bottom-up with the terms they build on, its domain services with their services and tests, and its repositories with the aggregates they persist.',
  method: 'GET',
  route: '/api/domain/get-domain',
} as const;

export const LIST_DOMAINS_IDENTITY = {
  id: 'LA-MOD-QRY131',
  slice: { aggregate: 'LA-MOD-A4', name: 'domain' },
  name: 'list-domains',
  description: 'Lists the domains of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/domain/list-domains',
} as const;

export const NEXT_DOMAIN_ID_IDENTITY = {
  id: 'LA-MOD-QRY132',
  slice: { aggregate: 'LA-MOD-A4', name: 'domain' },
  name: 'next-id',
  description: 'The next free ID for a capability, term, domain service or repository (under a domain), or a service or domain service test (under a domain service): one past the highest in use.',
  method: 'GET',
  route: '/api/domain/next-id',
} as const;
