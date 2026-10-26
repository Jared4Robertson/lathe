---
id: TL-LEND-E01
kind: endpoint
title: Register a member
parent: TL-LEND-API01
method: POST
route: /members
links:
  fulfills: [TL-LEND-UC01-R01, TL-LEND-UC01-R02, TL-LEND-UC01-R03]
---
Request: `{ "name": string, "email": string }`. Responds 201 with the member, or 400 / 409 with an error.

Each rule for its body and responses is one of its interaction requirements.
