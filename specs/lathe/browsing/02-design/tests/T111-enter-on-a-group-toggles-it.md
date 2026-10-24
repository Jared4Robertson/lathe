---
id: LA-BRW-T111
kind: test
title: Enter on a group opens or closes it and keeps keyboard focus on it
parent: LA-BRW
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-BRW-UC40-R02]
---
Focuses a group, presses Enter and expects its members with keyboard focus still on the group, then presses Enter again and expects it closed.
