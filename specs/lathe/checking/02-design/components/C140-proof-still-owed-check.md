---
id: LA-CHK-C140
kind: component
title: Proof still owed check
parent: LA-CHK
component_type: sql check
file: lathe/checks/53-proof-still-owed.sql
links:
  satisfies: [LA-CHK-UC20-R01, LA-CHK-DR140, LA-CHK-DR141, LA-CHK-DR144]
---
The `proof-still-owed` warning: for each obligation a domain owes, judged as in `lathe/src/coverage.ts`, that a backed automated or manual proof proves, one row for each planned test also meant to prove it. For a pattern rule only the owing domain's tests count, on both sides.
