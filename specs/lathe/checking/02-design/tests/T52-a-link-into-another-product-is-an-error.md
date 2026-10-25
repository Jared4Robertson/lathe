---
id: LA-CHK-T52
kind: test
title: A link into another product is an error
parent: LA-CHK
test_type: unit
run_by: lathe/test/link-crosses-product.test.ts
links:
  proves: [LA-AUT-DR75, LA-CHK-UC01-R04]
---
Loads two products where one's rule involves the other's aggregate and one's use case applies the other's rule, and expects one `link-crosses-product` error for each, none for the links inside a product, and none for a citation in prose.
