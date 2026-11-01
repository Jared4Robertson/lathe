// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_DOMAIN_IDENTITY = {
  id: 'LA-AUT-CMD160',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'add-domain',
  description: 'Adds a domain to its product, with nothing in it yet.',
  method: 'POST',
  route: '/api/domain/add-domain',
} as const;

export const CHANGE_DOMAIN_IDENTITY = {
  id: 'LA-AUT-CMD161',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'change-domain',
  description: 'Changes a domain\'s title, subdomain type, description or notes. Its product never changes.',
  method: 'POST',
  route: '/api/domain/change-domain',
} as const;

export const REMOVE_DOMAIN_IDENTITY = {
  id: 'LA-AUT-CMD162',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'remove-domain',
  description: 'Removes a domain whole: its capabilities, terms, domain services with their services and tests, repositories, and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/domain/remove-domain',
} as const;

export const ADD_CAPABILITY_IDENTITY = {
  id: 'LA-AUT-CMD163',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'add-capability',
  description: 'Adds a capability to its domain, at a position, with the business outcomes it serves.',
  method: 'POST',
  route: '/api/domain/add-capability',
} as const;

export const CHANGE_CAPABILITY_IDENTITY = {
  id: 'LA-AUT-CMD164',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'change-capability',
  description: 'Changes a capability\'s title, position or description, or the business outcomes it serves (the whole list).',
  method: 'POST',
  route: '/api/domain/change-capability',
} as const;

export const REMOVE_CAPABILITY_IDENTITY = {
  id: 'LA-AUT-CMD165',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'remove-capability',
  description: 'Removes a capability and the links it starts. Refused while a use case sits under it or anything else references it.',
  method: 'POST',
  route: '/api/domain/remove-capability',
} as const;

export const ADD_TERM_IDENTITY = {
  id: 'LA-AUT-CMD166',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'add-term',
  description: 'Adds a term to its domain\'s glossary, with what it means there and the terms it builds on.',
  method: 'POST',
  route: '/api/domain/add-term',
} as const;

export const CHANGE_TERM_IDENTITY = {
  id: 'LA-AUT-CMD167',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'change-term',
  description: 'Changes a term\'s title, meaning or group, or the terms it builds on (the whole list).',
  method: 'POST',
  route: '/api/domain/change-term',
} as const;

export const REMOVE_TERM_IDENTITY = {
  id: 'LA-AUT-CMD168',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'remove-term',
  description: 'Removes a term from its domain. Refused while anything references it.',
  method: 'POST',
  route: '/api/domain/remove-term',
} as const;

export const ADD_DOMAIN_SERVICE_IDENTITY = {
  id: 'LA-AUT-CMD169',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'add-domain-service',
  description: 'Adds a domain service to its domain, with what it must work out.',
  method: 'POST',
  route: '/api/domain/add-domain-service',
} as const;

export const CHANGE_DOMAIN_SERVICE_IDENTITY = {
  id: 'LA-AUT-CMD170',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'change-domain-service',
  description: 'Changes a domain service\'s title or statement.',
  method: 'POST',
  route: '/api/domain/change-domain-service',
} as const;

export const REMOVE_DOMAIN_SERVICE_IDENTITY = {
  id: 'LA-AUT-CMD171',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'remove-domain-service',
  description: 'Removes a domain service with its service and tests and the links they start. Refused while a command or query calls it, or anything else references it or them.',
  method: 'POST',
  route: '/api/domain/remove-domain-service',
} as const;

export const ADD_REPOSITORY_IDENTITY = {
  id: 'LA-AUT-CMD172',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'add-repository',
  description: 'Adds a repository to its domain, with the aggregate it persists, the data store it is stored in, the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/domain/add-repository',
} as const;

export const CHANGE_REPOSITORY_IDENTITY = {
  id: 'LA-AUT-CMD173',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'change-repository',
  description: 'Changes a repository\'s title, file or description, the aggregate it persists or the data store it is stored in (null clears either), or the standard rules it meets or packages it uses (each the whole list).',
  method: 'POST',
  route: '/api/domain/change-repository',
} as const;

export const REMOVE_REPOSITORY_IDENTITY = {
  id: 'LA-AUT-CMD174',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'remove-repository',
  description: 'Removes a repository with the links it starts and the packages it uses. Refused while anything references it.',
  method: 'POST',
  route: '/api/domain/remove-repository',
} as const;

export const ADD_SERVICE_IDENTITY = {
  id: 'LA-AUT-CMD175',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'add-service',
  description: 'Adds the service that implements a domain service in code, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/domain/add-service',
} as const;

export const CHANGE_SERVICE_IDENTITY = {
  id: 'LA-AUT-CMD176',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'change-service',
  description: 'Changes a service\'s title or file, or the standard rules it meets or packages it uses (each the whole list).',
  method: 'POST',
  route: '/api/domain/change-service',
} as const;

export const REMOVE_SERVICE_IDENTITY = {
  id: 'LA-AUT-CMD177',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'remove-service',
  description: 'Removes a service with the links it starts and the packages it uses. Refused while anything references it.',
  method: 'POST',
  route: '/api/domain/remove-service',
} as const;

export const ADD_DOMAIN_SERVICE_TEST_IDENTITY = {
  id: 'LA-AUT-CMD178',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'add-domain-service-test',
  description: 'Adds a domain service test under its domain service, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/domain/add-domain-service-test',
} as const;

export const CHANGE_DOMAIN_SERVICE_TEST_IDENTITY = {
  id: 'LA-AUT-CMD179',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'change-domain-service-test',
  description: 'Changes a domain service test\'s columns or the test data sets it starts from (the whole list).',
  method: 'POST',
  route: '/api/domain/change-domain-service-test',
} as const;

export const REMOVE_DOMAIN_SERVICE_TEST_IDENTITY = {
  id: 'LA-AUT-CMD180',
  slice: { aggregate: 'LA-AUT-A4', name: 'domain' },
  name: 'remove-domain-service-test',
  description: 'Removes a domain service test and the links it starts. Refused while anything references it.',
  method: 'POST',
  route: '/api/domain/remove-domain-service-test',
} as const;
