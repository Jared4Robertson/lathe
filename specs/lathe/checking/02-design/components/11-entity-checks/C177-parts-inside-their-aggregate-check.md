---
id: LA-CHK-C177
kind: component
title: Parts inside their aggregate check
parent: LA-CHK-LAY11
component_type: sql check
file: lathe/checks/69-has-crosses-aggregate.sql
links:
  satisfies: [LA-CHK-UC24-R06, LA-CHK-DR184, LA-CHK-DR185, LA-CHK-DR187]
---
Reports each `has_one` or `has_many` whose target entity sits in another aggregate than its source; `refers_to` links are never read.
