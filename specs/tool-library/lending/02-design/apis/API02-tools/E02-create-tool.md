---
id: TL-LEND-E02
kind: endpoint
title: Add a tool
parent: TL-LEND-API02
method: POST
route: /tools
links:
  fulfills: [TL-LEND-UC02-R01]
---
Request: `{ "name": string, "description"?: string }`. Responds 201 with the catalog entry, or 400 with an error.

Each rule for its body and responses is one of its interaction requirements.
