---
id: LA-MOD-DR13
kind: domain_rule
title: Aggregates raise domain events, and only domain events act on things
parent: LA-MOD-A1
---
A `raises` link MUST go from an aggregate to a domain event. Only a domain event MAY be the source of a `prompts`, `changes` or `sets` link.
