---
id: LA-CHK-DF01-S01
kind: design_step
title: The command line reads the product's configuration
parent: LA-CHK-DF01
order: 1
links:
  uses: [LA-AUT-C05]
---
`lathe check` calls `loadWorkspace` on the product root, which reads `lathe.config.json`: the specs folder, the meta-model extensions, the product's checks folder and `structure.maxChildren`.
