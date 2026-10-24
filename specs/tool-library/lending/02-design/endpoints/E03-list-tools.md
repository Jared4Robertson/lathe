---
id: TL-LEND-E03
kind: endpoint
title: List the catalog
parent: TL-LEND
method: GET
route: /tools
links:
  fulfills: [TL-LEND-UC02-R02, TL-LEND-UC04-R02, TL-LEND-UC04-R03]
---
No request body. Responds 200 with the catalog.

Each rule for its body and responses is one of its interaction requirements.

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`.
