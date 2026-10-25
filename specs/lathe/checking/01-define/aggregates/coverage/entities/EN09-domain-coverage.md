---
id: LA-CHK-EN09
kind: entity
title: Domain coverage
parent: LA-CHK-A4
role: root
links:
  has_many: [LA-CHK-EN10, LA-CHK-EN11]
  refers_to: [LA-MOD-EN04]
---
What a load counts for one domain: its tests by state, and below them each obligation kind and the gaps.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Domain | The domain counted. | Record reference. | TL-LEND |
| Automated tests | The domain's tests that run as code. | Derived count. | 32 |
| Manual tests | The domain's tests a person carries out. | Derived count. | 1 |
| Planned tests | The domain's tests not written yet. | Derived count. | 1 |
