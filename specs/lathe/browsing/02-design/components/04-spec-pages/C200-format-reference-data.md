---
id: LA-BRW-C200
kind: component
title: Format reference data
parent: LA-BRW-LAY04
component_type: react component
file: app/src/format/reference.ts
links:
  satisfies: [LA-BRW-DR210]
  depends_on: [LA-BRW-C01]
---
Fetches `GET /api/format` once something wants it, and again when the specs change; without an answer, builds the reference from the loaded workspace (no explanations). Holds the format pages' addresses and the lookups the pages share: a kind's relations in and out, the checks that name it, its folder.
