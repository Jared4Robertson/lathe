---
id: LA-AUT-DR72
kind: domain_rule
title: A rule across aggregates names the aggregates it involves
parent: LA-AUT-EN09
---
A domain rule that holds across aggregates MAY sit directly under its domain, and MUST then name with `involves` the two or more aggregates of that domain it ties together. Such a rule that involves fewer than two aggregates, counting only links to aggregates, SHOULD be a `domain-rule-involves` warning that says to move a one-aggregate rule under that aggregate. Each aggregate of another domain it involves SHOULD be a warning that says a rule across domains is a domain event's job. A domain rule under an aggregate or an entity that uses `involves` SHOULD be a warning, since its place already says what it is about.
