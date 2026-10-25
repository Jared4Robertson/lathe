---
id: LA-TRC-C32
kind: component
title: Proof still owed check
parent: LA-TRC-LAY04
component_type: sql check
file: lathe/checks/53-proof-still-owed.sql
links:
  satisfies: [LA-TRC-UC08-R01, LA-TRC-DR24, LA-TRC-DR25, LA-CHK-DR13]
---
The `proof-still-owed` warning: for each obligation a domain owes, judged as in `lathe/src/coverage.ts`, that a backed automated or manual proof proves, one row for each planned test also meant to prove it. For a pattern rule only the owing domain's tests count, on both sides.
