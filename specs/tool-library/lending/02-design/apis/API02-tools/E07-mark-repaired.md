---
id: TL-LEND-E07
kind: endpoint
title: Mark a tool repaired
parent: TL-LEND-API02
method: POST
route: "/tools/{toolId}/repair"
links:
  fulfills: [TL-LEND-UC05-R02]
---
No request body. Responds 200 with the catalog entry, or 404 / 409 with an error.

Each rule for its body and responses is one of its interaction requirements.
