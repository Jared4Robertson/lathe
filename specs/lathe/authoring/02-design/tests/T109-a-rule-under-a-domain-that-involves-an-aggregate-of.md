---
id: LA-AUT-T109
kind: test
title: A rule under a domain that involves an aggregate of another domain is a warning that says a rule across domains is a domain event's job
parent: LA-AUT
test_type: unit
run_by: lathe/test/domain-rule-involves.test.ts
links:
  proves: [LA-AUT-DR72]
---
Expects one `domain-rule-involves` warning for a rule that involves an aggregate of its own domain and one of another, naming that aggregate's domain and saying to raise an event in one domain and react to it in the other.
