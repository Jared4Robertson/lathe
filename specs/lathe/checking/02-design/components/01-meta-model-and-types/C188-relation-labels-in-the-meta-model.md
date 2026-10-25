---
id: LA-CHK-C188
kind: component
title: Relation labels in the meta-model
parent: LA-CHK-LAY01
component_type: meta-model
file: lathe/meta/relations.csv
links:
  satisfies: [LA-CHK-UC25-R07, LA-CHK-DR196, LA-CHK-DR197]
---
The `forward_label` and `reverse_label` columns of `relations.csv`, filled for every default rule. The meta-model loader merges a product's labels like the role and description, keeps them in the `relations` table, and passes them on in `RelationRule` and the reference.
