---
id: LA-AUT-C40
kind: component
title: Fields table reader
parent: LA-AUT-LAY05
component_type: service
file: lathe/src/parse.ts
links:
  satisfies: [LA-AUT-UC11-R02, LA-AUT-DR52]
---
`readFieldsTable` in the record parser: finds the first `## Fields` heading outside fenced code and the table under it before the next heading, and splits its header and rows into cells, keeping escaped pipes. `hasFieldsColumns` says whether the header is the four columns, Field, Meaning, Kind of value and Example, in any letter case.
