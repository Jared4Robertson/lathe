---
id: LA-AUT-C51
kind: component
title: Undocumented check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/71-undocumented.sql
links:
  satisfies: [LA-AUT-UC12-R06, LA-AUT-DR58, LA-CHK-DR26]
---
Reports each kind and relation rule with an empty description, and each row of `check_docs` whose header lacks something, naming the file and what it lacks.
