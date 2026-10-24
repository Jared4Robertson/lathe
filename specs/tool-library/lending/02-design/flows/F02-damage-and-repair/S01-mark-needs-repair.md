---
id: TL-LEND-F02-S01
kind: flow_step
title: A librarian marks a damaged tool as needing repair, with a note
parent: TL-LEND-F02
order: 1
links:
  uses: [TL-LEND-V02, TL-LEND-E06]
  fulfills: [TL-LEND-UC05-R01, TL-LEND-UC05-R03]
---
A librarian finds a damaged tool and, at the [Return desk](../../views/V02-return-desk.md), marks it as needing repair with a note (`POST /tools/{toolId}/damage`). If it is on loan, the loan carries on.
