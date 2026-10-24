---
id: LA-CHK-F03
kind: flow
title: Adapt the meta-model for a product
parent: LA-CHK-CAP03
links:
  carries_out: [LA-CHK-UC05, LA-CHK-UC09, LA-CHK-UC10, LA-CHK-UC14]
---
1. Jared decides a product needs a kind or relation Lathe does not have, or a default kind to sit somewhere new.
2. He adds rows to the product's `metaExtensions` CSVs, or changes Lathe's own `meta/` files, and reviews the diff.
3. The next check loads the merged meta-model, checks it for consistency, and rechecks every record against it; structural warnings show where records do not yet fit, each mistake reported once.
4. Use cases are grouped into capabilities and follow patterns as the meta-model allows.
