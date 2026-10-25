---
id: LA-AUT-T29
kind: test
title: Two capabilities in one domain with the same order are errors; other domains may reuse it
parent: LA-AUT
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-AUT-UC05-R03, LA-AUT-DR15]
---
Expects an error on each of two capabilities with orders `1` and `01` in one domain, each naming the other, and none on a capability with order 1 in another domain.
