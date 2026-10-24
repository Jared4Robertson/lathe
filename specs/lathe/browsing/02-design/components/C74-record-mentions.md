---
id: LA-BRW-C74
kind: component
title: A record body with its mentions
parent: LA-BRW
component_type: react component
file: app/src/specs/mentions.tsx
links:
  satisfies: [LA-BRW-UC60-R06, LA-BRW-UC60-R07, LA-BRW-DR72]
  depends_on: [LA-BRW-C73]
---
Builds a record's prose links from its `mentions` (missing means none) and the IDs named in its `unknown-id-in-prose` warnings, and renders its body with them. It only changes how the body reads: mentions never enter the links, the graph or coverage.
