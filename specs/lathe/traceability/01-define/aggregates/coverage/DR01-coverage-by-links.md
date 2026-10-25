---
id: LA-TRC-DR01
kind: domain_rule
title: Designed, built and proved are counted only from links
parent: LA-TRC-A1
---
An obligation (a record of a kind marked as an obligation) MUST count as **satisfied** (designed) only when at least one link whose relation has the `design` role targets it, as **built** only when at least one such link comes from a component whose `file` exists, and as **proved** only when at least one link with the `proof` role comes from an automated or manual test. A component whose file does not exist yet still counts as designed, never as built, and a planned test counts as planned, never as proof. Coverage MUST be counted in the domain the obligation belongs to, wherever the component or test sits.
