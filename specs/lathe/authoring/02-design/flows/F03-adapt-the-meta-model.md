---
id: LA-AUT-F03
kind: flow
title: Adapt the meta-model for a product
parent: LA-AUT-CAP02
links:
  carries_out: [LA-AUT-UC03, LA-AUT-UC04, LA-AUT-UC05, LA-CHK-UC04, LA-TRC-UC07, LA-AUT-UC08, LA-AUT-UC09, LA-CHK-UC06, LA-AUT-UC10, LA-AUT-UC11, LA-AUT-UC12, LA-AUT-UC13]
---
1. The owner decides a product needs a kind or relation Lathe does not have, or a default kind to sit somewhere new.
2. They add rows to the product's `metaExtensions` CSVs, or change Lathe's own `meta/` files, and review the diff.
3. The next check loads the merged meta-model, checks it for consistency, and rechecks every record against it; structural warnings show where records do not yet fit, each mistake reported once.
4. Use cases are grouped into capabilities, and use cases or whole domains follow patterns, as the meta-model allows; a kind may be made a full or a proof-only obligation.
