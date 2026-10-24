---
id: LA-CHK-DR07
kind: domain_rule
title: Designed, built and proved are counted only from links
parent: LA-CHK-A2
---
A requirement or domain rule MUST count as **satisfied** (designed) only when at least one component links to it with `satisfies`, as **built** only when at least one such component's `file` exists, and as **proved** only when at least one test links to it with `proves`. A component whose file does not exist yet still counts as designed, never as built. Coverage MUST be counted in the domain the requirement or rule belongs to, wherever the component or test sits.
