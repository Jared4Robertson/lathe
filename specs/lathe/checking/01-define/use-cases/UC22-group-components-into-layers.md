---
id: LA-CHK-UC22
kind: use_case
title: Group components into layers
parent: LA-CHK-CAP03
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR160, LA-CHK-DR161, LA-CHK-DR162, LA-CHK-DR163, LA-CHK-DR164, LA-CHK-DR165, LA-CHK-DR166, LA-CHK-DR167, LA-CHK-DR168, LA-CHK-DR169]
---
Jared, or an agent, groups a domain's components into ordered layers, such as Models, Services and Web app, as a domain's use cases are grouped into capabilities. Each product names its own layers as records. `lathe check` reports a bad or repeated layer order, and a component left directly under a domain that has layers, and a component in a layer counts in its domain exactly as one directly under it.
