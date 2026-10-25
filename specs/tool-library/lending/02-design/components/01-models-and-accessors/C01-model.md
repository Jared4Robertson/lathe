---
id: TL-LEND-C01
kind: component
title: model.ts
parent: TL-LEND-LAY01
component_type: model
file: examples/tool-library/src/model.ts
links:
  satisfies: [TL-LEND-DR04, TL-LEND-DR07, TL-LEND-DR08]
---
The Lending records (Member, Tool, Loan, catalog entry), the condition values, the loan constants (14 days, 3 loans), the library settings (`timeZone`, default `America/New_York`), and the rules that need no storage, all counted in calendar days in the library's time zone: the due date, whether a loan is overdue, and whether a return is late. Also a tool's status and `LendingError`, which carries the HTTP status and error code for a broken rule.
