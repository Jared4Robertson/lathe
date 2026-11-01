// Generated from data/ by `npm run generate`. Do not edit.

export const FILL_SLOT_IDENTITY = {
  id: 'LA-TRC-CMD11',
  slice: { aggregate: 'LA-TRC-A4', name: 'slot-filling' },
  name: 'fill-slot',
  description: 'Records that a technical record, written by hand, fills a slot of a pattern: a fill. Refused for a record a tooling record generates.',
  method: 'POST',
  route: '/api/slot-filling/fill-slot',
} as const;

export const STOP_FILLING_SLOT_IDENTITY = {
  id: 'LA-TRC-CMD12',
  slice: { aggregate: 'LA-TRC-A4', name: 'slot-filling' },
  name: 'stop-filling-slot',
  description: 'Ends a technical record\'s fill of a slot.',
  method: 'POST',
  route: '/api/slot-filling/stop-filling-slot',
} as const;
