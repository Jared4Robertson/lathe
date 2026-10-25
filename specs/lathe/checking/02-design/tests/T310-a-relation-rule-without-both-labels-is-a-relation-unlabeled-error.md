---
id: LA-CHK-T310
kind: test
title: A relation rule without both labels is a relation-unlabeled error
parent: LA-CHK
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-CHK-UC25-R07, LA-CHK-DR196, LA-CHK-DR197]
---
Adds relation rules with no labels, with only a forward label and with only a reverse label, and an extension row that restates a default rule with empty labels; expects one relation-unlabeled error for each new rule naming what it lacks, none for the restated rule, and none for Lathe's own meta-model.
