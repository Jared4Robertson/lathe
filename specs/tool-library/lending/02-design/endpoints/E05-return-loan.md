---
id: TL-LEND-E05
kind: endpoint
title: Return a tool
parent: TL-LEND
method: POST
route: "/loans/{loanId}/return"
links:
  fulfills: [TL-LEND-UC04-R01, TL-LEND-UC04-R02, TL-LEND-UC04-R03, TL-LEND-UC04-R04]
---
Request: `{ "condition": "good" | "needs_repair", "note"?: string }`. Responds 200 with the returned loan, or 400 / 404 / 409 with an error.

Each rule for its body and responses is one of its interaction requirements.

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`.
