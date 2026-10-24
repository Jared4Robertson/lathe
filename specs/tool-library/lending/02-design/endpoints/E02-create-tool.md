---
id: TL-LEND-E02
kind: endpoint
title: Add a tool
parent: TL-LEND
method: POST
route: /tools
links:
  fulfills: [TL-LEND-UC02-R01]
---
Request: `{ "name": string, "description"?: string }`.

| Status | When | Body |
| --- | --- | --- |
| 201 | Added. | The catalog entry: `id`, `name`, `description`, `condition` (`good`), `damageNote` (null), `addedAt`, `status` (`available`). |
| 400 `invalid_request` | Name blank. | Error. |

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`.
