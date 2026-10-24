---
id: TL-LEND-E06
kind: endpoint
title: Report damage to a tool
parent: TL-LEND
method: POST
route: "/tools/{toolId}/damage"
links:
  fulfills: [TL-LEND-UC05-R01, TL-LEND-UC05-R03]
---
Request: `{ "note": string }`. Responds 200 with the catalog entry, or 400 / 404 / 413 with an error.

Each rule for its body and responses is one of its interaction requirements.

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`.
