---
id: LA-MOD-F01
kind: flow
title: Create a diagram and open it
parent: LA-MOD
links:
  uses: [LA-MOD-V02, LA-MOD-E02, LA-MOD-E01, LA-MOD-V01]
  fulfills: [LA-MOD-UC01-R01]
  carries_out: [LA-MOD-UC01]
---
1. Jared opens the New diagram form and submits a title.
2. The form calls `POST /api/diagrams`.
3. On success the menu reloads from `GET /api/diagrams` and the app opens `/diagrams/<slug>`, which shows the empty-diagram message.
