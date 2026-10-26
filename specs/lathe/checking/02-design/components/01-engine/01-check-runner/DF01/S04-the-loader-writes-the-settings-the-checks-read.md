---
id: LA-CHK-DF01-S04
kind: design_step
title: The loader writes the settings the checks read
parent: LA-CHK-DF01
order: 4
links:
  uses: [LA-CHK-C16]
  satisfies: [LA-CHK-UC06-R02]
---
The `settings` table gets one row per setting a check reads, such as `structure.maxChildren`.
