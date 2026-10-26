---
id: LA-PAT-APP-CODE-R05
kind: pattern_rule
title: Kind labels become plural only through plural() and lowercase only through lowerLabel()
parent: LA-PAT-APP-CODE
group: Components and words
---
Code MUST make a kind's label plural with `plural()` from `app/src/plural.ts`, never by adding an "s", so every page and the graph say "Capabilities" and "Fitness" the same way. Inside a sentence a label MUST be lowercased with `lowerLabel()`, which keeps an acronym such as "UC requirement" whole, never with `toLowerCase()`.
