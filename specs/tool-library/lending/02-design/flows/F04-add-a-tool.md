---
id: TL-LEND-F04
kind: flow
title: Add a tool to the catalog
parent: TL-LEND-CAP02
links:
  uses: [TL-LEND-E02, TL-LEND-E03, TL-LEND-V01]
  fulfills: [TL-LEND-UC02-R01, TL-LEND-UC02-R02]
  carries_out: [TL-LEND-UC02]
---
How a donated or bought tool becomes available to borrow.

1. A librarian adds the tool with its name and, optionally, a description (`POST /tools`). A blank name is refused.
2. The new tool starts in good condition, and the [Catalog](../views/V01-catalog.md) lists it as available (`GET /tools`).
