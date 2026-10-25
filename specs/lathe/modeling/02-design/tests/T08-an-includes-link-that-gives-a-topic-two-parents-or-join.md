---
id: LA-MOD-T08
kind: test
title: An includes link that gives a topic two parents, or joins a non-topic, is reported
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR14]
---
Loads a diagram in which one topic is included by two topics and a topic includes a plain term, and expects both reported.
