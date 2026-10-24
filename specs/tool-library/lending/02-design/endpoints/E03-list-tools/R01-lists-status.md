---
id: TL-LEND-E03-R01
kind: interaction_requirement
title: The catalog lists every tool with its status
parent: TL-LEND-E03
links:
  fulfills: [TL-LEND-UC02-R02, TL-LEND-UC04-R02, TL-LEND-UC04-R03]
---
The response MUST be 200 with an array of every catalog entry in ID order. Each entry MUST carry `condition`, `damageNote` and `status`: `on_loan` when the tool has an active loan, otherwise `needs_repair` when its condition is `needs_repair`, otherwise `available`.
