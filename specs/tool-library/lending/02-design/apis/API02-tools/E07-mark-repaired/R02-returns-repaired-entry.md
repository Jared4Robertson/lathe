---
id: TL-LEND-E07-R02
kind: interaction_requirement
title: Marking a tool repaired returns 200 with it available
parent: TL-LEND-E07
links:
  fulfills: [TL-LEND-UC05-R02]
---
A successful repair MUST return 200 with the catalog entry: `condition` `good`, `damageNote` null and, unless the tool is on loan, `status` `available`.
