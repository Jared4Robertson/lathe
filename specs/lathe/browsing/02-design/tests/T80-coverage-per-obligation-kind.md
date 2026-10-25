---
id: LA-BRW-T80
kind: test
title: Coverage shows one group per obligation kind with designed, built, proved and planned
parent: LA-BRW
test_type: component
run_by: app/test/obligations.test.tsx
links:
  proves: [LA-BRW-UC30-R01, LA-BRW-DR30]
---
Serves a workspace whose coverage has four obligation kinds, one of them a product's own, and expects four labeled groups in the engine's order on the domain card and the domain page, each with designed, built, proved and planned, and a planned bar that is never drawn full.
