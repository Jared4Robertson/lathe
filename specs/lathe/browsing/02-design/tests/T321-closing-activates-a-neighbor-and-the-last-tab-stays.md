---
id: LA-BRW-T321
kind: test
title: Closing the active tab activates its right neighbor, or else the left; closing the last leaves it as a preview; cycling wraps
parent: LA-BRW
test_type: unit
run_by: app/test/tabs.test.ts
links:
  proves: [LA-BRW-DR151, LA-BRW-UC112-R03]
---
Cycles three lasting tabs both ways past each end, closes the active first tab and expects its right neighbor active, closes an inactive tab and expects the active one kept, closes the rightmost and expects its left neighbor, and closes the last and expects it still open, as the preview. Unknown keys change nothing.
