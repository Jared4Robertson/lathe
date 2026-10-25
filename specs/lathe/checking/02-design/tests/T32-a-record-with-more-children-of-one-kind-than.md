---
id: LA-CHK-T32
kind: test
title: A record with more children of one kind than maxChildren is a warning naming the parent, kind and count
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC06-R01, LA-CHK-DR14]
---
With `maxChildren` 3, expects a `too-many-children` warning for an aggregate with 4 domain rules, naming it, the kind and the count, and saying to add a level between them.
