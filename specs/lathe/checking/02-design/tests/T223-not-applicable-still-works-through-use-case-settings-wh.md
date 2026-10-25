---
id: LA-CHK-T223
kind: test
title: Not applicable still works through use-case settings when the domain follows only through its use cases
parent: LA-CHK
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-CHK-UC19-R02, LA-CHK-DR131]
---
Every following use case of a domain marks a rule's setting Not applicable; expects that rule not counted and nothing reported for it there.
