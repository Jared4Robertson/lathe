---
id: LA-TRC-T30
kind: test
title: An unproved pattern rule is reported once for each domain that owes it, saying when its test is only planned
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R05]
---
Expects one `unproved` warning per rule and owing domain with no proving test of its own, and the message for a domain whose only test is planned to say so.
