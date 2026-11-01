// Generated from data/ by `npm run generate`. Do not edit.

export const LIST_COVERAGE_GAPS_IDENTITY = {
  id: 'LA-TRC-QRY02',
  slice: { aggregate: 'LA-TRC-RM02', name: 'coverage-gaps' },
  name: 'list-coverage-gaps',
  description: 'Lists a product\'s coverage gaps, its own scope\'s then each domain\'s: each obligation not designed, built or proved and each record short of a minimum, with what it lacks. Runs the checks first.',
  method: 'GET',
  route: '/api/coverage-gaps/list-coverage-gaps',
} as const;

export const FIND_UNUSED_PACKAGES_IDENTITY = {
  id: 'LA-TRC-QRY12',
  slice: { aggregate: 'LA-TRC-RM02', name: 'coverage-gaps' },
  name: 'find-unused-packages',
  description: 'Finds the packages a product\'s package manifests list that no record of it names: its one package-not-accounted-for gap, naming each package with the manifests that list it, or none. Runs the checks first.',
  method: 'GET',
  route: '/api/coverage-gaps/find-unused-packages',
} as const;
