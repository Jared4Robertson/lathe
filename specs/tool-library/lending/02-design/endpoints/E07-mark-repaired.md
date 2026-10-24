---
id: TL-LEND-E07
kind: endpoint
title: Mark a tool repaired
parent: TL-LEND
method: POST
route: "/tools/{toolId}/repair"
links:
  fulfills: [TL-LEND-UC05-R02]
---
No request body.

| Status | When | Body |
| --- | --- | --- |
| 200 | Repaired: condition `good`, damage note cleared. | The catalog entry. |
| 404 `tool_not_found` | No such tool. | Error. |
| 409 `tool_not_damaged` | The tool is already in good condition. | Error. |

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`.
