---
id: LA-CHK-UC06
kind: use_case
title: Keep each level of the spec a useful size
parent: LA-CHK-CAP02
actor: Owner, Agent
links:
  applies: [LA-CHK-DR14, LA-CHK-DR15, LA-CHK-DR16, LA-CHK-DR17, LA-CHK-DR18, LA-CHK-DR19, LA-CHK-DR20, LA-CHK-DR21, LA-CHK-DR22, LA-CHK-DR23]
---
The owner, or an agent, keeps each level of a product's spec small enough to read and big enough to group something. `lathe check` warns when a record holds more children of one kind than the product's `structure.maxChildren` setting, and when a capability, a layer or a group holds only one record, counting a flow's steps per path and requirements and rules per group, so that a missing or needless level is found while the spec is written.
