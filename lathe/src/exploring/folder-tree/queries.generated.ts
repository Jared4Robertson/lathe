// Generated from data/ by `npm run generate`. Do not edit.

export const GET_FOLDER_TREE_IDENTITY = {
  id: 'LA-EXP-QRY05',
  slice: { aggregate: 'LA-EXP-RM02', name: 'folder-tree' },
  name: 'get-folder-tree',
  description: 'Gets a product\'s nav tree: Shared with what the product shares, then each domain in ID order; in each its stages, in each stage one folder per kind in kind order with the records that start a branch there and what folds under each, then the kinds outside the stages.',
  method: 'GET',
  route: '/api/folder-tree/get-folder-tree',
} as const;
