---
id: TL-LEND-E04-R02
kind: interaction_requirement
title: A member who cannot borrow is refused with 409 and the reason
parent: TL-LEND-E04
links:
  fulfills: [TL-LEND-UC03-R03, TL-LEND-DR02, TL-LEND-DR03]
---
When the member has an overdue loan the response MUST be 409 `member_overdue`. When the member already holds 3 active loans it MUST be 409 `loan_limit_reached`.
