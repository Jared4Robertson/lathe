---
id: TL-LEND-Q01
kind: question
title: Should a good return clear damage reported during the loan?
parent: TL-LEND-UC04
owner: Jared
links:
  about: [TL-LEND-UC04-R02, TL-LEND-UC05-R03]
---
If a librarian reports damage on a tool while it is on loan, and the tool later comes back and is recorded as `good`, which wins?

- **Keep the reported damage (current choice).** Safer: someone must look again and mark it repaired. Costs one extra step when the report was wrong.
- **The return condition wins.** The inspection at the desk is the latest look at the tool. Risks lending a tool that is still damaged if the inspection misses it.

The example keeps the reported damage (`lending-service.ts`, test TL-LEND-T26).
