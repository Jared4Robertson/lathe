// Generated from data/ by `npm run generate`. Do not edit.

export const ADD_TABLE_IDENTITY = {
  id: 'LA-TEC-CMD300',
  slice: { aggregate: 'LA-TEC-A18', name: 'table' },
  name: 'add-table',
  description: 'Adds a table under the one entity, read model or domain it stores, with its keys in order, the data store it is kept in, the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/table/add-table',
} as const;

export const CHANGE_TABLE_IDENTITY = {
  id: 'LA-TEC-CMD301',
  slice: { aggregate: 'LA-TEC-A18', name: 'table' },
  name: 'change-table',
  description: 'Changes a table\'s title, name, storage or file, its keys (the whole list, in order), the data store it is kept in (null clears it), or the standard rules it meets or packages it uses (each the whole list). Its parent changes only by a move.',
  method: 'POST',
  route: '/api/table/change-table',
} as const;

export const MOVE_TABLE_IDENTITY = {
  id: 'LA-TEC-CMD302',
  slice: { aggregate: 'LA-TEC-A18', name: 'table' },
  name: 'move-table',
  description: 'Moves a table, with its keys, under another entity, read model or domain: exactly one is given, and it replaces the parent it had. A table moved under another domain takes that domain\'s ID in place of the old one\'s, and every record that names it names the new ID; one under an entity or read model moves with it.',
  method: 'POST',
  route: '/api/table/move-table',
} as const;

export const REMOVE_TABLE_IDENTITY = {
  id: 'LA-TEC-CMD303',
  slice: { aggregate: 'LA-TEC-A18', name: 'table' },
  name: 'remove-table',
  description: 'Removes a table whole: its keys, and the links and packages it names. Refused while anything else references it, such as another table\'s foreign key.',
  method: 'POST',
  route: '/api/table/remove-table',
} as const;
