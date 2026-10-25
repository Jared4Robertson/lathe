---
id: LA-AUT-C15
kind: component
title: Prose ID reader
parent: LA-AUT-LAY05
component_type: service
file: lathe/src/parse.ts
links:
  satisfies: [LA-CHK-UC03-R02, LA-AUT-DR19]
---
`idTokensInProse` and `proseTokens` in the record parser: blank out fenced code blocks and inline code spans (keeping a span that holds one lone ID), then return every whole ID-shaped token left in the body, in order.
