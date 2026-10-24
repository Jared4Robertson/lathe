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
| Status | When | Body |
| --- | --- | --- |
| 200 | Always. | Array of catalog entries in ID order, each with `status`: `available`, `on_loan` or `needs_repair`. |

Errors are JSON: `{ "error": "<code>", "message": "<sentence>" }`.
