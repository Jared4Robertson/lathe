---
id: LA-CHK-C172
kind: component
title: Fields table reader
parent: LA-CHK-LAY03
component_type: service
file: lathe/src/parse.ts
links:
  satisfies: [LA-CHK-UC24-R02, LA-CHK-DR182]
---
`readFieldsTable` in the record parser: finds the first `## Fields` heading outside fenced code and the table under it before the next heading, and splits its header and rows into cells, keeping escaped pipes. `hasFieldsColumns` says whether the header is the four columns, Field, Meaning, Kind of value and Example, in any letter case.
