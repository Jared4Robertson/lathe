---
id: LA-TRC-DR15
kind: domain_rule
title: The unproved warnings and coverage count the same proof
parent: LA-TRC-A1
---
An obligation MUST be reported as `unproved` exactly when coverage does not count it as proved: an automated test's claim counts only when its file backs it, by naming the test's own ID, its `key`, or the obligation.
