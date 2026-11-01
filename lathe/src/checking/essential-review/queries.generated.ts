// Generated from data/ by `npm run generate`. Do not edit.

export const LIST_ESSENTIAL_RECORDS_IDENTITY = {
  id: 'LA-CHK-QRY13',
  slice: { aggregate: 'LA-CHK-RM12', name: 'essential-review' },
  name: 'list-essential-records',
  description: 'Lists a product\'s essential records alone, grouped by domain, each with its kind, title and lead text, leaving out every accidental record, pattern and test. Worked out from the data on every read.',
  method: 'GET',
  route: '/api/essential-review/list-essential-records',
} as const;
