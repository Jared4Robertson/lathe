---
id: LA-AUT-T11
kind: test
title: Every rule and requirement in Lathe's own specs states its rule with MUST, SHOULD or MAY under a short title
parent: LA-AUT
test_type: integration
run_by: lathe/test/records.test.ts
links:
  proves: [LA-AUT-UC01-R02]
---
Loads this repo's workspace and expects every Lathe requirement and domain rule body to use MUST, SHOULD or MAY, with a title of at most 15 words.
