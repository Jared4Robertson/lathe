---
id: LA-AUT-T35
kind: test
title: A record mentions the existing IDs its body cites, in order of first mention
parent: LA-AUT
test_type: unit
run_by: lathe/test/mentions.test.ts
links:
  proves: [LA-CHK-UC03-R01, LA-AUT-DR20]
---
Expects a use case citing several records, one of them twice, to mention each existing one once in order of first mention, and a body that cites nothing, or names a product and domain only in plain prose, to mention nothing.
