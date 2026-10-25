---
id: LA-CHK-C87
kind: component
title: Parent kind check
parent: LA-CHK-LAY04
component_type: sql check
file: lathe/checks/07-parent-kind-not-allowed.sql
links:
  satisfies: [LA-CHK-UC14-R07, LA-CHK-UC14-R08, LA-CHK-DR82]
---
The `parent-kind-not-allowed` check, one row per record: judged only against parents that exist, and reported only when no record with the parent ID is of an allowed kind.
