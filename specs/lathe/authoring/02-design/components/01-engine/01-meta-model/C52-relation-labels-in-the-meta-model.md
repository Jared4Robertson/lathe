---
id: LA-AUT-C52
kind: component
title: Relation labels in the meta-model
parent: LA-AUT-LAY02
component_type: meta-model
file: lathe/meta/relations.csv
links:
  satisfies: [LA-AUT-UC11-R07, LA-AUT-DR61, LA-AUT-DR62]
---
The `forward_label` and `reverse_label` columns of `relations.csv`, filled for every default rule. The meta-model loader merges a product's labels like the role and description, keeps them in the `relations` table, and passes them on in `RelationRule` and the reference.
