---
id: LA-EXP-T34
kind: test
title: o on a group opens or closes it and keeps keyboard focus on it; Enter goes to it
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC04-R02]
---
Focuses a group, presses o and expects its members with keyboard focus still on the group, presses o again and expects it closed with focus kept, then presses Enter and expects the group's address.
