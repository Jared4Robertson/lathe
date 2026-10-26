---
id: LA-TRC-DR19
kind: domain_rule
title: A domain that follows a pattern itself owes every one of its rules
parent: LA-TRC-A3
---
When a domain record `follows` a pattern, the domain MUST owe each of the pattern's rules, whatever its use cases give for the pattern's settings, since the domain's own follow cannot be marked Not applicable. Only a rule with an `applies_when` that no follower there meets is waived; the domain counts as a follower, through the settings it gives as header fields on its own record.
