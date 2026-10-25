---
id: LA-CHK-C160
kind: component
title: Layer kind in the meta-model
parent: LA-CHK-LAY01
component_type: meta-model
file: lathe/meta/kinds.csv
links:
  satisfies: [LA-CHK-UC22-R01, LA-CHK-DR160, LA-CHK-DR161, LA-CHK-DR169]
---
The `layer` row of `kinds.csv`: a design-stage kind in the Technical specification folder, under a domain or a layer, requiring `order`, and not an obligation. The `component` row names `domain layer` as its parent kinds, and no other row but `layer` names `layer`.
