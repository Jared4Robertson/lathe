---
id: LA-CHK-C15
kind: component
title: maxChildren in the config loader
parent: LA-CHK-LAY02
component_type: engine module
file: lathe/src/config.ts
links:
  satisfies: [LA-CHK-UC06-R02, LA-CHK-DR15, LA-CHK-DR16]
---
`loadConfig` reads `structure.maxChildren` into `LatheConfig.maxChildren`, using `DEFAULT_MAX_CHILDREN` (15) when it is absent, and throws when it is not a whole number of at least 1.
