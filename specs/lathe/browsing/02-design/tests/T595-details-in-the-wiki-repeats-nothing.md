---
id: LA-BRW-T595
kind: test
title: In the Wiki view Details shows only what the page does not, or a focused or right-clicked row
parent: LA-BRW
test_type: acceptance
run_by: app/test/side-bar.test.tsx
links:
  proves: [LA-BRW-UC119-R03, LA-BRW-DR340]
---
Expects the spec file, the raw header fields and the raw links, and no children, problems or identity block; a record row with focus shows that record as "Selected" until focus leaves; a right-clicked row stays until a click elsewhere.
