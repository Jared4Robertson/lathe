---
id: LA-CHK-T221
kind: test
title: A domain that follows a pattern itself owes every one of its rules, even where its use cases say Not applicable
parent: LA-CHK
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-CHK-UC19-R01, LA-CHK-DR130]
---
A domain follows a pattern itself while its one use case marks a rule's setting Not applicable; expects that rule still owed there, with its `proves` gap and `unproved` warning naming the domain.
