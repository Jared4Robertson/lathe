---
id: LA-CHK-Q11
kind: question
title: Should Lathe help a product require one Record view use case per aggregate?
parent: LA-CHK
owner: Jared
links:
  about: [LA-CHK-UC10]
---
S2's house rule is that each aggregate has exactly one use case that reads it, following its Record view pattern. That rule belongs to a product, not to Lathe, so it would be one of the product's own checks. Product-specific checks are a later feature; until then, should Lathe ship anything for this, or leave it to the product?
