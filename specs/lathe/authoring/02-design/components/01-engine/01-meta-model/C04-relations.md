---
id: LA-AUT-C04
kind: component
title: Relation rules
parent: LA-AUT-LAY02
component_type: data
file: lathe/meta/relations.csv
links:
  satisfies: [LA-AUT-DR08, LA-TRC-UC03-R04, LA-TRC-DR28]
---
The relations allowed between kinds of record, one row per source kind and target kind. The `supports` rows, from a test to each obligation kind, have no role, so coverage and the proof checks never read them.
