---
id: TL-LEND-C01
kind: component
title: model.ts
parent: TL-LEND
component_type: model
file: examples/tool-library/src/model.ts
links:
  satisfies: [TL-LEND-DR04, TL-LEND-DR07, TL-LEND-DR08]
---
The Lending records (Member, Tool, Loan, catalog entry), the condition values, the loan constants (14 days, 3 loans), and the rules that need no storage: the due time, whether a loan is overdue, whether a return is late, and a tool's status. Also `LendingError`, which carries the HTTP status and error code for a broken rule.
