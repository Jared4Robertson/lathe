---
id: TL-LEND-E04-R04
kind: interaction_requirement
title: The first failing check is the one reported
parent: TL-LEND-E04
links:
  fulfills: [TL-LEND-UC03-R02, TL-LEND-UC03-R03, TL-LEND-UC03-R04]
---
When several checks fail, the response MUST report only the first, in this order: invalid body, unknown member, unknown tool, member overdue, loan limit reached, tool needs repair, tool on loan.
