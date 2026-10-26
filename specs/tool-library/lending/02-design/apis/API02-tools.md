---
id: TL-LEND-API02
kind: api
title: Tools
parent: TL-LEND
---
The catalog, at `/tools`: adding tools, listing them, and recording damage and repairs.

## Shapes

The request and response shapes its endpoints share, as JSON objects.

| Shape | Meaning | Fields |
| --- | --- | --- |
| Tool | One tool and its condition. | `id`, `name`, `description`, `condition` (`good` or `needs_repair`), `damageNote`, `addedAt` |
| Catalog entry | A tool as the catalog lists it. | A tool's fields, and `status` |
| Error | Every refusal of every endpoint here. | `error` (a code such as `tool_on_loan`), `message` (a sentence) |
