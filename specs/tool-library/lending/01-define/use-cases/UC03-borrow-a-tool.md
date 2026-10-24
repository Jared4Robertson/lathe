---
id: TL-LEND-UC03
kind: use_case
title: Borrow a tool
parent: TL-LEND-CAP03
actor: Member
links:
  applies: [TL-LEND-DR02, TL-LEND-DR03, TL-LEND-DR05, TL-LEND-DR06, TL-LEND-DR07]
---
A member borrows an available tool for the loan period.

1. The member picks a tool from the catalog.
2. The library checks the member can borrow and the tool can be lent.
3. The library records the loan and tells the member when it is due.

When a check fails, the library says which one, in this order: unknown member, unknown tool, member has an overdue loan, member is at the loan limit, tool needs repair, tool is on loan.
