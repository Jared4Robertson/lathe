---
id: LA-TRC-T58
kind: test
title: A product that makes pattern rules full obligations again has them designed per domain, a domain that follows itself included
parent: LA-TRC
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-TRC-UC07-R06, LA-TRC-UC07-R01, LA-AUT-DR34, LA-TRC-DR19]
---
An extension sets `pattern_rule` to `yes`; expects one domain's component to design one rule there, and `unsatisfied` warnings per rule and domain, including the domain that follows the pattern itself.
