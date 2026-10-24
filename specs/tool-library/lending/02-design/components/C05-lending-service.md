---
id: TL-LEND-C05
kind: component
title: lending-service.ts
parent: TL-LEND
component_type: service
file: examples/tool-library/src/lending-service.ts
links:
  satisfies: [TL-LEND-DR02, TL-LEND-DR03, TL-LEND-DR05, TL-LEND-DR06, TL-LEND-DR07, TL-LEND-DR08, TL-LEND-DR09, TL-LEND-DR10, TL-LEND-DR11, TL-LEND-UC03-R01, TL-LEND-UC03-R02, TL-LEND-UC03-R03, TL-LEND-UC03-R04, TL-LEND-UC04-R01, TL-LEND-UC04-R02, TL-LEND-UC04-R03, TL-LEND-UC04-R04, TL-LEND-E04-R01, TL-LEND-E04-R02, TL-LEND-E04-R03, TL-LEND-E04-R04, TL-LEND-E04-R05, TL-LEND-E05-R01, TL-LEND-E05-R02, TL-LEND-E05-R03, TL-PAT-LIBRARIAN-ACTION-R01]
  depends_on: [TL-LEND-C01, TL-LEND-C02]
---
Borrowing and returning. `borrow` runs the checks in the order the [Borrow endpoint](../endpoints/E04-create-loan.md) lists, inside one transaction, and creates a loan due 14 calendar days later. `return` requires a valid condition before it changes anything (the Librarian action pattern's rule R01), refuses a second return, records the condition and note, takes a tool returned needing repair out of lending, never clears damage reported during the loan, and reports whether the return was late. Takes a clock so tests can move time, and the library's time zone (default `America/New_York`; an unknown zone is refused), in which it counts due dates and overdue loans.
