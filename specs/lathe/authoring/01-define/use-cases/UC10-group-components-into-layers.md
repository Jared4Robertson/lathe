---
id: LA-AUT-UC10
kind: use_case
title: Group components into layers
parent: LA-AUT-CAP02
actor: Owner, Agent
links:
  applies: [LA-AUT-DR40, LA-AUT-DR41, LA-AUT-DR42, LA-AUT-DR43, LA-AUT-DR44, LA-AUT-DR45, LA-AUT-DR46, LA-AUT-DR47, LA-AUT-DR48, LA-AUT-DR49]
---
The owner, or an agent, groups a domain's components into ordered layers, such as Models, Services and Web app, as a domain's use cases are grouped into capabilities. Each product names its own layers as records. `lathe check` reports a bad or repeated layer order, and a component left directly under a domain that has layers, and a component in a layer counts in its domain exactly as one directly under it.
