---
id: LA-AUT-T26
kind: test
title: A kind defined twice in one folder is an error naming that folder
parent: LA-AUT
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-AUT-UC05-R04, LA-AUT-DR14]
---
Loads an extension folder with two `domain_rule` rows and expects one `meta-duplicate-kind` error naming `lathe-meta/kinds.csv`, while both rows still widen the kind.
