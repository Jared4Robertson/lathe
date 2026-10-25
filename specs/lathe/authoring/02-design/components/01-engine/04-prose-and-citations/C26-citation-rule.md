---
id: LA-AUT-C26
kind: component
title: Citation rule
parent: LA-AUT-LAY05
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-AUT-UC08-R01, LA-AUT-UC08-R02, LA-AUT-UC08-R03, LA-AUT-UC08-R04, LA-AUT-DR27, LA-AUT-DR28, LA-AUT-DR29, LA-AUT-DR30]
---
The test in `readProseCitations` that decides which tokens are citations: a product's or domain's own ID only when it came from a lone-ID code span; otherwise any record's ID, or a token starting with a product ID, a domain ID or an `idPrefixes` entry and a hyphen. Only these tokens go into `prose_mentions`, so the unknown-ID check sees only tokens with a known prefix.
