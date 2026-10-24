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
Request: `{ "note": string }`.

| Status | When | Body |
| --- | --- | --- |
| 200 | Marked as needing repair. Any active loan is left as it is, and a later `good` return does not clear the damage. | The catalog entry. |
| 400 `invalid_request` | Note blank. | Error. |
| 404 `tool_not_found` | No such tool. | Error. |

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`.
