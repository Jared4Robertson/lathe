---
id: LA-CHK-F03
kind: flow
title: Review problems while an agent edits
parent: LA-CHK
links:
  uses: [LA-CHK-V01, LA-EXP-V03, LA-PLT-E01, LA-AUT-V03, LA-AUT-V02]
  fulfills: [LA-CHK-UC07-R01, LA-PLT-UC03-R01, LA-AUT-UC14-R03, LA-AUT-UC14-R05]
  carries_out: [LA-CHK-UC07, LA-PLT-UC03, LA-AUT-UC14]
---
1. While an agent edits records, the owner keeps the Checks page (`/checks`) open: every problem, errors first, grouped by check.
2. Each time a record file or the engine's rules change, the page reloads `GET /api/spec` and shows the problems as they are on disk now.
3. They open a problem's record page to see the record and its problems, and go back to the list.
4. When a check is unfamiliar, they follow its code to the check's page in the format reference: what it asks, how to fix it, and every problem it reports now. From the record's side bar, its Kind leads to what the format says about that kind.
