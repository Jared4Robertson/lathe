---
id: LA-CHK-DR52
kind: domain_rule
title: A pattern rule is Not applicable only when every following use case says so
parent: LA-CHK-A6
---
A domain MUST NOT owe a pattern rule when the rule depends on a setting, the domain itself does not follow the pattern, and every one of the domain's use cases that follow it marks that setting `Not applicable:` with a reason. One following use case that gives the setting a value MUST be enough for the domain to owe the rule.
