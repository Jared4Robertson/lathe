---
id: LA-TRC-DR17
kind: domain_rule
title: A test is counted once, in its own domain, by its state
parent: LA-TRC-A1
---
Each test record MUST be counted in exactly one domain's tests, the domain it sits in, under exactly one state: automated, manual or planned. A test with no `state` is automated.
