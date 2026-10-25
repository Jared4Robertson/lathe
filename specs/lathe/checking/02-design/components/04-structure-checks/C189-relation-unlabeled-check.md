---
id: LA-CHK-C189
kind: component
title: Relation unlabeled check
parent: LA-CHK-LAY04
component_type: sql check
file: lathe/checks/72-relation-unlabeled.sql
links:
  satisfies: [LA-CHK-UC25-R07, LA-CHK-DR196]
---
Reports each merged relation rule with an empty `forward_label` or `reverse_label`, naming the rule and which label it lacks.
