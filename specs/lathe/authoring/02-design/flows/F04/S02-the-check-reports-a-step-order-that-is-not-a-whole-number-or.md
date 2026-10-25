---
id: LA-AUT-F04-S02
kind: flow_step
title: The check reports a step order that is not a whole number or that two steps share
parent: LA-AUT-F04
order: 2
links:
  uses: [LA-AUT-C19]
  fulfills: [LA-AUT-UC06-R02, LA-AUT-UC06-R03, LA-AUT-DR24]
---
`lathe check` reports `flow-step-order` errors, and a missing order as a missing required field.
