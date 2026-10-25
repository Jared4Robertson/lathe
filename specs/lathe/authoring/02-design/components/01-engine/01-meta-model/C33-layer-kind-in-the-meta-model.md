---
id: LA-AUT-C33
kind: component
title: Layer kind in the meta-model
parent: LA-AUT-LAY02
component_type: meta-model
file: lathe/meta/kinds.csv
links:
  satisfies: [LA-AUT-UC10-R01, LA-AUT-DR40, LA-AUT-DR41, LA-AUT-DR49]
---
The `layer` row of `kinds.csv`: a design-stage kind in the Technical specification folder, under a domain or a layer, requiring `order`, and not an obligation. The `component` row names `domain layer` as its parent kinds, and no other row but `layer` names `layer`.
