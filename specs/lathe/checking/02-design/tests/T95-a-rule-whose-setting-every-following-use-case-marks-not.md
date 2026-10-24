---
id: LA-CHK-T95
kind: test
title: A rule whose setting every following use case marks Not applicable does not apply in that domain
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R04, LA-CHK-DR52]
---
Both following use cases in a domain mark the rule's setting `Not applicable:` with a reason, in different letter cases; expects the rule neither counted nor reported there.
