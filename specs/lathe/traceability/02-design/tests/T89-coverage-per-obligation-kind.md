---
id: LA-TRC-T89
kind: test
title: Coverage shows one group per obligation kind with designed, built, proved and planned
parent: LA-TRC
test_type: component
run_by: app/test/obligations.test.tsx
links:
  proves: [LA-TRC-UC11-R01, LA-TRC-DR32]
---
Serves a workspace whose coverage has four obligation kinds, one of them a product's own, and expects four labeled groups in the engine's order on the domain card and the domain page, each with designed, built, proved and planned, and a planned bar that is never drawn full.
