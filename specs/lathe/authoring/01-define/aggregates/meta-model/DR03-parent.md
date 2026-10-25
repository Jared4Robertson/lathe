---
id: LA-AUT-DR03
kind: domain_rule
title: Every record but a product has a parent of an allowed kind
parent: LA-AUT-EN01
---
A product record MUST NOT have a parent. Every other record MUST have a parent that exists, and the parent's kind MUST be one of the record kind's `parent_kinds` in `lathe/meta/kinds.csv`. Following parents MUST NOT lead back to the same record.
