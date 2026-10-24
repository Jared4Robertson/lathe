---
id: LA-CHK-F17-S04
kind: flow_step
title: "The writer moves the flow's fulfills onto its steps, and the check reports any left over"
parent: LA-CHK-F17
order: 4
links:
  uses: [LA-CHK-C113, LA-CHK-C114]
  fulfills: [LA-CHK-UC17-R05, LA-CHK-UC17-R06, LA-CHK-DR112]
---
Each `fulfills` link moves from the flow to the step that does it. A link left on the flow that no step has is a `flow-fulfills-differs-from-steps` warning.
