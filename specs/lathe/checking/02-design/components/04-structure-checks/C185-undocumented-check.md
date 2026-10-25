---
id: LA-CHK-C185
kind: component
title: Undocumented check
parent: LA-CHK-LAY04
component_type: sql check
file: lathe/checks/71-undocumented.sql
links:
  satisfies: [LA-CHK-UC25-R06, LA-CHK-DR192, LA-CHK-DR193]
---
Reports each kind and relation rule with an empty description, and each row of `check_docs` whose header lacks something, naming the file and what it lacks.
