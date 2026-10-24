---
id: TL-LEND-E01
kind: endpoint
title: Register a member
parent: TL-LEND
method: POST
route: /members
links:
  fulfills: [TL-LEND-UC01-R01, TL-LEND-UC01-R02, TL-LEND-UC01-R03]
---
Request: `{ "name": string, "email": string }`.

| Status | When | Body |
| --- | --- | --- |
| 201 | Registered. | The member: `id`, `name`, `email` (lower case), `joinedAt`. |
| 400 `invalid_request` | Name blank, or email missing or invalid. | Error. |
| 409 `email_taken` | The email is already registered. | Error. |

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`.
