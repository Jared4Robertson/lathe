---
id: LA-EXP-C22
kind: component
title: A record body with its mentions
parent: LA-EXP-LAY07
component_type: react component
file: app/src/specs/mentions.tsx
links:
  satisfies: [LA-EXP-UC02-R06, LA-EXP-UC02-R07, LA-EXP-V03-R04]
  depends_on: [LA-EXP-C21]
---
Builds a record's prose links from its `mentions` (missing means none) and the IDs named in its `unknown-id-in-prose` warnings, and renders its body with them. It only changes how the body reads: mentions never enter the links, the graph or coverage.
