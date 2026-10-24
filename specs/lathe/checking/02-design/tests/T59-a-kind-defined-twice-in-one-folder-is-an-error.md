---
id: LA-CHK-T59
kind: test
title: A kind defined twice in one folder is an error naming that folder
parent: LA-CHK
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-CHK-UC09-R04, LA-CHK-DR32]
---
Loads an extension folder with two `domain_rule` rows and expects one `meta-duplicate-kind` error naming `lathe-meta/kinds.csv`, while both rows still widen the kind.
