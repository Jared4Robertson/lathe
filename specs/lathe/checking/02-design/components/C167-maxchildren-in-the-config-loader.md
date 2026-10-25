---
id: LA-CHK-C167
kind: component
title: maxChildren in the config loader
parent: LA-CHK
component_type: engine module
file: lathe/src/config.ts
links:
  satisfies: [LA-CHK-UC23-R02, LA-CHK-DR171, LA-CHK-DR172]
---
`loadConfig` reads `structure.maxChildren` into `LatheConfig.maxChildren`, using `DEFAULT_MAX_CHILDREN` (15) when it is absent, and throws when it is not a whole number of at least 1.
