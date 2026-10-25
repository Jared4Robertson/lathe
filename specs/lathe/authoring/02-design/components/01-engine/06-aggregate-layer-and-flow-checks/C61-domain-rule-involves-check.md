---
id: LA-AUT-C61
kind: component
title: Domain rule involves check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/77-domain-rule-involves.sql
links:
  satisfies: [LA-AUT-DR72]
---
Warns of each domain rule under a domain that involves fewer than two aggregates, of each aggregate of another domain such a rule involves, and of each rule under an aggregate or entity that uses `involves`.
