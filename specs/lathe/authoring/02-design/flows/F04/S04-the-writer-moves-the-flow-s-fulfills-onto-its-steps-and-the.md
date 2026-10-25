---
id: LA-AUT-F04-S04
kind: flow_step
title: The writer moves the flow's fulfills onto its steps, and the check reports any left over
parent: LA-AUT-F04
order: 4
links:
  uses: [LA-AUT-C21, LA-AUT-C22]
  fulfills: [LA-AUT-UC06-R05, LA-AUT-UC06-R06, LA-AUT-DR26]
---
Each `fulfills` link moves from the flow to the step that does it. A link left on the flow that no step has is a `flow-fulfills-differs-from-steps` warning.
