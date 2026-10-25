---
id: LA-TRC-T25
kind: test
title: A rule whose setting every following use case marks Not applicable does not apply in that domain
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R04, LA-TRC-DR09]
---
Both following use cases in a domain mark the rule's setting `Not applicable:` with a reason, in different letter cases; expects the rule neither counted nor reported there.
