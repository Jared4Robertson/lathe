---
id: LA-CHK-DR07
kind: domain_rule
title: A gap check waits until the stage it looks for has started
parent: LA-CHK-A1
---
A check that looks for a missing link to a later stage MUST stay silent in a domain that has no records of that stage yet: `use-case-without-flow` reports nothing in a domain with no flows.
