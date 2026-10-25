---
id: LA-AUT-C36
kind: component
title: Entity kind and relations in the meta-model
parent: LA-AUT-LAY02
component_type: meta-model
file: lathe/meta/relations.csv
links:
  satisfies: [LA-AUT-UC10-R01, LA-AUT-DR55]
---
The `entity` row of `kinds.csv`, in the define stage's domain model folder under an aggregate and requiring `role`, and the `has_one`, `has_many` and `refers_to` rows of `relations.csv`, each from entity to entity, and the `involves` row from domain rule to aggregate. The `domain_rule` row says a rule across aggregates sits under the domain and names them with `involves`.
