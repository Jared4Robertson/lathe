---
id: LA-CHK-F17-S02
kind: flow_step
title: The check reports a step order that is not a whole number or that two steps share
parent: LA-CHK-F17
order: 2
links:
  uses: [LA-CHK-C111]
  fulfills: [LA-CHK-UC17-R02, LA-CHK-UC17-R03, LA-CHK-DR110]
---
`lathe check` reports `flow-step-order` errors, and a missing order as a missing required field.
