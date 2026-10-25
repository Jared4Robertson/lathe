---
id: LA-CHK-C70
kind: component
title: Prose ID reader
parent: LA-CHK
component_type: service
file: lathe/src/parse.ts
links:
  satisfies: [LA-CHK-UC13-R02, LA-CHK-DR70]
---
`idTokensInProse` and `proseTokens` in the record parser: blank out fenced code blocks and inline code spans (keeping a span that holds one lone ID), then return every whole ID-shaped token left in the body, in order.
