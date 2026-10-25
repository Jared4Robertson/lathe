---
id: LA-PLT-C22
kind: component
title: Theme store
parent: LA-PLT-LAY05
component_type: typescript module
file: app/src/theme/store.ts
links:
  satisfies: [LA-PLT-UC07-R06, LA-PLT-DR15]
  depends_on: [LA-PLT-C20]
---
Keeps the person's themes, the chosen one, the mode and the chosen theme's stylesheet in local storage, dropping stored themes that no longer read.
