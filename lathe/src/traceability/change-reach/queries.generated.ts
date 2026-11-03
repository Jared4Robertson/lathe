// Generated from data/ by `npm run generate`. Do not edit.

export const GET_REACH_IDENTITY = {
  id: 'LA-TRC-QRY20',
  slice: { aggregate: 'LA-TRC-RM14', name: 'change-reach' },
  name: 'get-reach',
  description: 'Gets what a change of one or more records would touch, before it is made: every record that sits under them or depends on them, followed on through what builds and proves each, each once with the changed records it is reached from and the path of links that reaches it, grouped by stage; the files those records name and the tests among them with their states; and the use cases, journeys and business outcomes they serve. Never follows a link up to a purpose. Worked out from the records and the checks\' run on every read; refuses a record the data does not hold. Runs the checks first.',
  method: 'GET',
  route: '/api/change-reach/get-reach',
} as const;
