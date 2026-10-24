---
id: TL-LEND-E02-R02
kind: interaction_requirement
title: Adding a tool returns 201 with an available catalog entry
parent: TL-LEND-E02
links:
  fulfills: [TL-LEND-UC02-R02, TL-LEND-DR04]
---
A successful add MUST return 201 with the catalog entry: `id`, `name`, `description`, `condition` (`good`), `damageNote` (null), `addedAt` and `status` (`available`).
