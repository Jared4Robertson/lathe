// Generated from data/ by `npm run generate`. Do not edit.

export const FOLLOW_PATTERN_IDENTITY = {
  id: 'LA-TRC-CMD01',
  slice: { aggregate: 'LA-TRC-A3', name: 'pattern-following' },
  name: 'follow-pattern',
  description: 'Makes a domain or use case follow a pattern, with the value it gives each of the pattern\'s settings.',
  method: 'POST',
  route: '/api/pattern-following/follow-pattern',
} as const;

export const CHANGE_SETTING_VALUES_IDENTITY = {
  id: 'LA-TRC-CMD02',
  slice: { aggregate: 'LA-TRC-A3', name: 'pattern-following' },
  name: 'change-setting-values',
  description: 'Gives a followed pattern\'s settings their values: the list replaces the follower\'s values for that pattern.',
  method: 'POST',
  route: '/api/pattern-following/change-setting-values',
} as const;

export const STOP_FOLLOWING_PATTERN_IDENTITY = {
  id: 'LA-TRC-CMD10',
  slice: { aggregate: 'LA-TRC-A3', name: 'pattern-following' },
  name: 'stop-following-pattern',
  description: 'Ends a domain\'s or use case\'s following of a pattern, with the setting values it gave it.',
  method: 'POST',
  route: '/api/pattern-following/stop-following-pattern',
} as const;
