---
id: TL-LEND-F02-S03
kind: flow_step
title: Once fixed, the librarian marks it repaired and it is available again
parent: TL-LEND-F02
order: 3
links:
  uses: [TL-LEND-V02, TL-LEND-E07]
  fulfills: [TL-LEND-UC05-R02]
---
Once the tool is fixed, the librarian marks it repaired (`POST /tools/{toolId}/repair`) and the catalog shows it as available.
