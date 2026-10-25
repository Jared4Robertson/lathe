---
id: LA-CHK-T681
kind: test
title: "A domain whose code names a technology is a warning, and one named so in both title and code says both"
parent: LA-CHK
test_type: unit
run_by: lathe/test/domain-names.test.ts
links:
  proves: [LA-CHK-DR350]
---
Expects a warning for a domain coded BACKEND under a capability title, and one message naming both the title and the code for a domain titled Front-end and coded FRONTEND.
