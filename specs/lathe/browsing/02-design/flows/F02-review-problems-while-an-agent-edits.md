---
id: LA-BRW-F02
kind: flow
title: Review problems while an agent edits
parent: LA-BRW
links:
  uses: [LA-BRW-V05, LA-BRW-V04, LA-BRW-E01]
  fulfills: [LA-BRW-UC04-R01, LA-BRW-UC05-R01]
  carries_out: [LA-BRW-UC04, LA-BRW-UC05]
---
1. While an agent edits records, the owner keeps the Checks page (`/checks`) open: every problem, errors first, grouped by check.
2. Each time a record file or the engine's rules change, the page reloads `GET /api/spec` and shows the problems as they are on disk now.
3. They open a problem's record page to see the record and its problems, and go back to the list.
