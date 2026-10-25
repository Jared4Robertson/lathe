---
id: LA-CHK-C122
kind: component
title: Code span marker in the prose token reader
parent: LA-CHK-LAY03
component_type: service
file: lathe/src/parse.ts
links:
  satisfies: [LA-CHK-UC18-R03, LA-CHK-DR122]
---
`proseTokens` in the record parser: returns each ID-shaped token with `inCode` true when it came from a code span holding just that ID, including an ID with no hyphen such as a product ID.
