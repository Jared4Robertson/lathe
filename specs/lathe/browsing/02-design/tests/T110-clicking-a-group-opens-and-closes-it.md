---
id: LA-BRW-T110
kind: test
title: Clicking a group opens it in place, clicking again closes it, and open groups are remembered
parent: LA-BRW
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-BRW-UC40-R01, LA-BRW-UC40-R02]
---
Renders a domain, expects folder-shaped folded groups with counts, clicks one and expects its members without an address change, walks to a member and back and expects it still open, then clicks it closed.
