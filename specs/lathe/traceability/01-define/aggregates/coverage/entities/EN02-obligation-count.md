---
id: LA-TRC-EN02
kind: entity
title: Obligation count
parent: LA-TRC-A1
role: child
---
The counts for one obligation kind in the domain, every one from links and from tests that run.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Kind | The obligation kind counted. | Kind reference. | domain_rule |
| Total | How many the domain owes. | Derived count. | 11 |
| Designed | How many a design link targets. | Derived count. | 11 |
| Built | How many a component whose file exists designs. | Derived count. | 11 |
| Proved | How many an automated or manual test proves. | Derived count. | 11 |
| Planned | How many are not proved but a planned test is meant to prove. | Derived count. | 0 |
| Still owed | How many a planned test is meant to prove, proved or not. | Derived count. | 0 |
