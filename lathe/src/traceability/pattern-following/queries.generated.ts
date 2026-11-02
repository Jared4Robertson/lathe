// Generated from data/ by `npm run generate`. Do not edit.

export const GET_FOLLOWING_IDENTITY = {
  id: 'LA-TRC-QRY10',
  slice: { aggregate: 'LA-TRC-A3', name: 'pattern-following' },
  name: 'get-following',
  description: 'Reads a domain\'s or use case\'s following of a pattern whole: the value it gives each of the pattern\'s settings.',
  method: 'GET',
  route: '/api/pattern-following/get-following',
} as const;

export const LIST_FOLLOWINGS_IDENTITY = {
  id: 'LA-TRC-QRY11',
  slice: { aggregate: 'LA-TRC-A3', name: 'pattern-following' },
  name: 'list-followings',
  description: 'Lists the patterns a domain or use case follows, by ID.',
  method: 'GET',
  route: '/api/pattern-following/list-followings',
} as const;

export const LIST_FOLLOWERS_IDENTITY = {
  id: 'LA-TRC-QRY14',
  slice: { aggregate: 'LA-TRC-A3', name: 'pattern-following' },
  name: 'list-followers',
  description: 'Lists a pattern\'s followers by domain, in position order: whether the domain itself follows it, and each of its use cases that does, each with the value it gives each of the pattern\'s settings.',
  method: 'GET',
  route: '/api/pattern-following/list-followers',
} as const;
