---
id: TL-LEND-F02
kind: flow
title: Damage and repair
parent: TL-LEND
links:
  uses: [TL-LEND-V01, TL-LEND-V02, TL-LEND-E03, TL-LEND-E06, TL-LEND-E07]
  fulfills: [TL-LEND-UC05-R01, TL-LEND-UC05-R02, TL-LEND-UC05-R03]
---
How a damaged tool leaves lending and comes back.

1. A librarian finds a damaged tool and, at the [Return desk](../views/V02-return-desk.md), marks it as needing repair with a note (`POST /tools/{toolId}/damage`). If it is on loan, the loan carries on.
2. The [Catalog](../views/V01-catalog.md) shows the tool as needing repair (or on loan), and borrowing it is refused.
3. Once fixed, the librarian marks it repaired (`POST /tools/{toolId}/repair`) and the catalog shows it as available.
