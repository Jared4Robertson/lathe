---
id: TL-LEND-E01-R01
kind: interaction_requirement
title: A registration body needs a name and a valid email
parent: TL-LEND-E01
links:
  fulfills: [TL-LEND-UC01-R01]
---
The body MUST be `{ "name": string, "email": string }`. The name is trimmed and MUST NOT be blank; the email is trimmed and MUST look like an address (`x@y.z`, no spaces). Otherwise the response MUST be 400 `invalid_request`.
