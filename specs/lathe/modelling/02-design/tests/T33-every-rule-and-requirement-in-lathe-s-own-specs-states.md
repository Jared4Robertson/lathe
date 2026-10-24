---
id: LA-MOD-T33
kind: test
title: "Every rule and requirement in Lathe's own specs states its rule with MUST, SHOULD or MAY under a short title"
parent: LA-MOD
test_type: integration
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC03-R02]
---
Loads this repo's workspace and expects every Lathe requirement and domain rule body to use MUST, SHOULD or MAY, with a title of at most 15 words.
