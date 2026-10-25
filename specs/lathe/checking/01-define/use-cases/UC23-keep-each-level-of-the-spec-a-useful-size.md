---
id: LA-CHK-UC23
kind: use_case
title: Keep each level of the spec a useful size
parent: LA-CHK-CAP03
actor: Owner, Agent
links:
  applies: [LA-CHK-DR170, LA-CHK-DR171, LA-CHK-DR172, LA-CHK-DR173, LA-CHK-DR174, LA-CHK-DR175, LA-CHK-DR176, LA-CHK-DR177, LA-CHK-DR178, LA-CHK-DR179]
---
The owner, or an agent, keeps each level of a product's spec small enough to read and big enough to group something. `lathe check` warns when a record holds more children of one kind than the product's `structure.maxChildren` setting, and when a capability or a layer holds only one record, so that a missing or needless level is found while the spec is written.
