---
id: LA-CHK-DR07
kind: domain_rule
title: Satisfied and proved are counted only from links
parent: LA-CHK-A2
---
A requirement or domain rule MUST count as **satisfied** only when at least one component links to it with `satisfies`, and as **proved** only when at least one test links to it with `proves`. Coverage MUST be counted in the domain the requirement or rule belongs to, wherever the component or test sits.
