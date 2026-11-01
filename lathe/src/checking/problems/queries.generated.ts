// Generated from data/ by `npm run generate`. Do not edit.

export const LIST_PROBLEMS_IDENTITY = {
  id: 'LA-CHK-QRY02',
  slice: { aggregate: 'LA-CHK-RM01', name: 'problems' },
  name: 'list-problems',
  description: 'Lists a product\'s problems, errors before warnings, grouped by check, then the problems that belong to no product under Workspace, with the errors and warnings counted. Runs the checks first.',
  method: 'GET',
  route: '/api/problems/list-problems',
} as const;
