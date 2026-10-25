---
id: LA-AUT-C27
kind: component
title: Code span marker in the prose token reader
parent: LA-AUT-LAY05
component_type: service
file: lathe/src/parse.ts
links:
  satisfies: [LA-AUT-UC08-R03, LA-AUT-DR29]
---
`proseTokens` in the record parser: returns each ID-shaped token with `inCode` true when it came from a code span holding just that ID, including an ID with no hyphen such as a product ID.
