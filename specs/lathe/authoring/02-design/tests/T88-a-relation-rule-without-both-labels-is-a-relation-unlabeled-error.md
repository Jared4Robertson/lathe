---
id: LA-AUT-T88
kind: test
title: A relation rule without both labels is a relation-unlabeled error
parent: LA-AUT
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-AUT-UC12-R07, LA-AUT-DR61, LA-AUT-DR62]
---
Adds relation rules with no labels, with only a forward label and with only a reverse label, and an extension row that restates a default rule with empty labels; expects one relation-unlabeled error for each new rule naming what it lacks, none for the restated rule, and none for Lathe's own meta-model.
