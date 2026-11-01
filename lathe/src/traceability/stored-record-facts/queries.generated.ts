// Generated from data/ by `npm run generate`. Do not edit.

export const FIND_UNDEFINED_STORED_KINDS_IDENTITY = {
  id: 'LA-TRC-QRY09',
  slice: { aggregate: 'LA-TRC-RM07', name: 'stored-record-facts' },
  name: 'find-undefined-stored-kinds',
  description: 'Finds the stored kinds of a product whose files do not define them as the spec says: each part (the kind itself, a field, a primary, unique or foreign key) the file it names does not define, by record. Runs the checks first.',
  method: 'GET',
  route: '/api/stored-record-facts/find-undefined-stored-kinds',
} as const;
