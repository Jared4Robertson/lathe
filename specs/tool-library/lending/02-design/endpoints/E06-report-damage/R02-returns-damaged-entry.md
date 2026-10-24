---
id: TL-LEND-E06-R02
kind: interaction_requirement
title: A damage report returns 200 with the tool needing repair
parent: TL-LEND-E06
links:
  fulfills: [TL-LEND-UC05-R01, TL-LEND-UC05-R03]
---
A successful report MUST return 200 with the catalog entry: `condition` `needs_repair` and `damageNote` the trimmed note. Its `status` stays `on_loan` while the tool is lent, since the loan carries on.
