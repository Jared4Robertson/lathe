---
id: LA-AUT-C55
kind: component
title: Relation unlabeled check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/72-relation-unlabeled.sql
links:
  satisfies: [LA-AUT-UC12-R07, LA-AUT-DR61]
---
Reports each merged relation rule with an empty `forward_label` or `reverse_label`, naming the rule and which label it lacks.
