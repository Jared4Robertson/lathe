---
id: TL-LEND-F01-S02
kind: flow_step
title: The member borrows an available tool, or is told why not
parent: TL-LEND-F01
order: 2
links:
  uses: [TL-LEND-V01, TL-LEND-E04]
  fulfills: [TL-LEND-UC03-R02, TL-LEND-UC03-R03]
---
The member picks an available tool and borrows it (`POST /loans`). If the tool is not available, or the member cannot borrow, the catalog shows the reason.
