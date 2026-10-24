---
id: TL-LEND-E01-R02
kind: interaction_requirement
title: A registered email is refused with 409 email_taken
parent: TL-LEND-E01
links:
  fulfills: [TL-LEND-UC01-R02, TL-LEND-DR01]
---
When a member with the same email, ignoring case and surrounding spaces, is already registered, the response MUST be 409 `email_taken`.
