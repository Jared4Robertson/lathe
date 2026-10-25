---
id: LA-CHK-C121
kind: component
title: Citation rule
parent: LA-CHK-LAY03
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC18-R01, LA-CHK-UC18-R02, LA-CHK-UC18-R03, LA-CHK-UC18-R04, LA-CHK-DR120, LA-CHK-DR121, LA-CHK-DR122, LA-CHK-DR123]
---
The test in `readProseCitations` that decides which tokens are citations: a product's or domain's own ID only when it came from a lone-ID code span; otherwise any record's ID, or a token starting with a product ID, a domain ID or an `idPrefixes` entry and a hyphen. Only these tokens go into `prose_mentions`, so the unknown-ID check sees only tokens with a known prefix.
