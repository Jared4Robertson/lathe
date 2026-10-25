---
id: LA-CHK-DR142
kind: domain_rule
title: No test's proof silently counts nowhere
parent: LA-CHK-A2
---
A test whose every proof counts in no domain's coverage MUST be reported, with the reason for each target. A test's proof counts when its target is an obligation in a domain, or a pattern rule owed by the domain the test sits in. A test with at least one proof that counts MUST NOT be reported.
