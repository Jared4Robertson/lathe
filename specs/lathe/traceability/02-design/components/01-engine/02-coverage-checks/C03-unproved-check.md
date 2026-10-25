---
id: LA-TRC-C03
kind: component
title: Unproved check
parent: LA-TRC-LAY03
component_type: sql check
file: lathe/checks/16-unproved.sql
links:
  satisfies: [LA-TRC-UC02-R02, LA-TRC-UC02-R03, LA-AUT-DR12, LA-TRC-DR02]
---
Warns about each obligation of any obligation kind that no automated or manual test proves, saying when its test is only planned.
