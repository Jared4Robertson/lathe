---
id: LA-CHK-C380
kind: component
title: Domain rule involves check
parent: LA-CHK-LAY11
component_type: sql check
file: lathe/checks/77-domain-rule-involves.sql
links:
  satisfies: [LA-CHK-DR370]
---
Warns of each domain rule under a domain that involves fewer than two aggregates, of each aggregate of another domain such a rule involves, and of each rule under an aggregate or entity that uses `involves`.
