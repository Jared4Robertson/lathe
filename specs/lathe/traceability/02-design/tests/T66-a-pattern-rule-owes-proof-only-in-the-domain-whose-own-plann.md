---
id: LA-TRC-T66
kind: test
title: A pattern rule owes proof only in the domain whose own planned test is meant to prove it
parent: LA-TRC
test_type: unit
run_by: lathe/test/owed-and-silent.test.ts
links:
  proves: [LA-TRC-UC08-R01, LA-TRC-DR25]
---
Expects `proof-still-owed` on a pattern rule in the domain whose planned test is meant to prove it, naming that domain, and not in the other following domain.
