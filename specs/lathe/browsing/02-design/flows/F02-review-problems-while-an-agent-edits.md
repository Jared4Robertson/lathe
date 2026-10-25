---
id: LA-BRW-F02
kind: flow
title: Review problems while an agent edits
parent: LA-BRW
links:
  uses: [LA-BRW-V05, LA-BRW-V04, LA-BRW-E01, LA-BRW-V08, LA-BRW-V07]
  fulfills: [LA-BRW-UC04-R01, LA-BRW-UC05-R01, LA-BRW-UC115-R03, LA-BRW-UC115-R05]
  carries_out: [LA-BRW-UC04, LA-BRW-UC05, LA-BRW-UC115]
---
1. While an Agent edits records, the Owner keeps the Checks page (`/checks`) open: every problem, errors first, grouped by check.
2. Each time a record file or the engine's rules change, the page reloads `GET /api/spec` and shows the problems as they are on disk now.
3. The Owner opens a problem's record page to see the record and its problems, and goes back to the list.
4. When a check is unfamiliar, the Owner follows its code to the check's page in the format reference: what it asks, how to fix it, and every problem it reports now. From the record's inspector, its Kind leads to what the format says about that kind.
