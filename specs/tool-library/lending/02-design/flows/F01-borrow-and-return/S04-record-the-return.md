---
id: TL-LEND-F01-S04
kind: flow_step
title: The librarian records the return and its condition
parent: TL-LEND-F01
order: 4
links:
  uses: [TL-LEND-V02, TL-LEND-E05]
  fulfills: [TL-LEND-UC04-R01]
---
When the member brings the tool back, the librarian opens the [Return desk](../../views/V02-return-desk.md) and records its condition (`POST /loans/{loanId}/return`). A return without a condition is refused.
