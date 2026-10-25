---
id: TL-LEND-C02
kind: component
title: store.ts
parent: TL-LEND-LAY02
component_type: accessor
file: examples/tool-library/src/store.ts
links:
  satisfies: [TL-LEND-DR01, TL-LEND-DR04, TL-LEND-DR06]
  depends_on: [TL-LEND-C01]
---
Reads and writes members, tools and loans in SQLite through `node:sqlite` (in memory by default). The schema backs up three rules even if a service misses them: a unique index on member email (DR01), a CHECK on the condition values (DR04), and a unique partial index allowing one active loan per tool (DR06). It also stores a loan's due date as a date (YYYY-MM-DD), with a CHECK on its shape. Offers `transaction()` so each check and its write happen together.
