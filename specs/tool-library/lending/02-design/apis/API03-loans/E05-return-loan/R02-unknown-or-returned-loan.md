---
id: TL-LEND-E05-R02
kind: interaction_requirement
title: An unknown or already returned loan is refused
parent: TL-LEND-E05
links:
  fulfills: [TL-LEND-DR09]
---
When no loan has that ID the response MUST be 404 `loan_not_found`. When the loan was already returned it MUST be 409 `already_returned`, and the loan MUST NOT change.
