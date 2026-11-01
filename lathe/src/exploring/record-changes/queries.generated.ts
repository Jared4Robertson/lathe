// Generated from data/ by `npm run generate`. Do not edit.

export const LIST_RECORD_CHANGES_IDENTITY = {
  id: 'LA-EXP-QRY13',
  slice: { aggregate: 'LA-EXP-RM07', name: 'record-changes' },
  name: 'list-record-changes',
  description: 'Lists the records that differ between a product\'s baseline (the last commit with `commit`, where the branch left the default branch with `branch`, or a commit\'s hash) and its data now: each added, removed or changed, with its own fields that changed, its parts and the links it starts.',
  method: 'GET',
  route: '/api/record-changes/list-record-changes',
} as const;
