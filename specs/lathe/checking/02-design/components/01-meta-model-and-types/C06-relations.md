---
id: LA-CHK-C06
kind: component
title: Relation rules
parent: LA-CHK-LAY01
component_type: data
file: lathe/meta/relations.csv
links:
  satisfies: [LA-CHK-DR01, LA-CHK-UC27-R01, LA-CHK-DR203]
---
The relations allowed between kinds of record, one row per source kind and target kind. The `supports` rows, from a test to each obligation kind, have no role, so coverage and the proof checks never read them.
