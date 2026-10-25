---
id: LA-AUT-C45
kind: component
title: Parts inside their aggregate check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/69-has-crosses-aggregate.sql
links:
  satisfies: [LA-AUT-UC11-R06, LA-AUT-DR54, LA-AUT-DR55, LA-AUT-DR57]
---
Reports each `has_one` or `has_many` whose target entity sits in another aggregate than its source; `refers_to` links are never read.
