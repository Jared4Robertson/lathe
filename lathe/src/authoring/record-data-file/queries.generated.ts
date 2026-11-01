// Generated from data/ by `npm run generate`. Do not edit.

export const FIND_RECORD_DATA_FILE_IDENTITY = {
  id: 'LA-AUT-QRY05',
  slice: { aggregate: 'LA-AUT-RM02', name: 'record-data-file' },
  name: 'find-record-data-file',
  description: 'Returns the full path of the data file that holds the record: its kind\'s file in its product\'s data folder; refused when no record has the ID.',
  method: 'GET',
  route: '/api/record-data-file/find-record-data-file',
} as const;
