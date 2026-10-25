---
id: LA-PAT-APP-CODE-R05
kind: pattern_rule
title: Kind labels become plural only through plural()
parent: LA-PAT-APP-CODE
---
Code MUST make a kind's label plural with `plural()` from `app/src/plural.ts`, never by adding an "s", so every page and the graph say "Capabilities" and "Fitness" the same way.
