---
id: LA-CHK-T241
kind: test
title: A pattern rule owes proof only in the domain whose own planned test is meant to prove it
parent: LA-CHK
test_type: unit
run_by: lathe/test/owed-and-silent.test.ts
links:
  proves: [LA-CHK-UC20-R01, LA-CHK-DR141]
---
Expects `proof-still-owed` on a pattern rule in the domain whose planned test is meant to prove it, naming that domain, and not in the other following domain.
