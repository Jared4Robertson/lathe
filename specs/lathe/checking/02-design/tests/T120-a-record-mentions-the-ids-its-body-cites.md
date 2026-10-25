---
id: LA-CHK-T120
kind: test
title: "A record mentions the existing IDs its body cites, in order of first mention"
parent: LA-CHK
test_type: unit
run_by: lathe/test/mentions.test.ts
links:
  proves: [LA-CHK-UC13-R01, LA-CHK-DR71]
---
Expects a use case citing several records, one of them twice, to mention each existing one once in order of first mention, and a body that cites nothing, or names a product and domain only in plain prose, to mention nothing.
