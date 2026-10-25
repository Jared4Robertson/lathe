---
id: LA-CHK-C10
kind: component
title: Parent kind check
parent: LA-CHK-LAY03
component_type: sql check
file: lathe/checks/07-parent-kind-not-allowed.sql
links:
  satisfies: [LA-CHK-UC04-R07, LA-CHK-UC04-R08, LA-CHK-DR06]
---
The `parent-kind-not-allowed` check, one row per record: judged only against parents that exist, and reported only when no record with the parent ID is of an allowed kind.
