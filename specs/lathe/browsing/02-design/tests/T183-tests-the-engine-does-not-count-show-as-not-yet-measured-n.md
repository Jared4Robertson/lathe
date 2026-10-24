---
id: LA-BRW-T183
kind: test
title: Tests the engine does not count show as not yet measured, never as zero
parent: LA-BRW
test_type: unit
run_by: app/test/owed-proof.test.tsx
links:
  proves: [LA-BRW-DR80, LA-BRW-UC70-R02]
---
Leaves one domain's `tests` out and expects `Tests not yet measured` there and an unknown product total; leaves out one count and expects only that state unknown.
