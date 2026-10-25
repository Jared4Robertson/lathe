---
id: LA-AUT-T121
kind: test
title: A record never mentions another product's records
parent: LA-AUT
test_type: unit
run_by: lathe/test/mentions.test.ts
links:
  proves: [LA-AUT-DR75]
---
Loads a workspace with two products, where a use case cites one record of its own product and one of the other product. Expects only its own product's record among its mentions, and no unknown-ID warning for the other product's ID.
