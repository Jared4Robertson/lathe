---
id: LA-CHK-C22
kind: component
title: Unproved check
parent: LA-CHK-LAY07
component_type: sql check
file: lathe/checks/16-unproved.sql
links:
  satisfies: [LA-CHK-UC07-R02, LA-CHK-UC07-R03, LA-CHK-DR20, LA-CHK-DR21]
---
Warns about each obligation of any obligation kind that no automated or manual test proves, saying when its test is only planned.
