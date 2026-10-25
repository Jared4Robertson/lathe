---
id: LA-TRC-EN01
kind: entity
title: Domain coverage
parent: LA-TRC-A1
role: root
links:
  has_many: [LA-TRC-EN02, LA-TRC-EN03]
---
What a load counts for one domain: its tests by state, and below them each obligation kind and the gaps.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Domain | The domain counted. | Record reference. | TL-LEND |
| Automated tests | The domain's tests that run as code. | Derived count. | 32 |
| Manual tests | The domain's tests a person carries out. | Derived count. | 1 |
| Planned tests | The domain's tests not written yet. | Derived count. | 1 |
