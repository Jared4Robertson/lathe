---
id: LA-EXP-T162
kind: test
title: In the Wiki view Details shows only what the page does not, or a focused or right-clicked row
parent: LA-EXP
test_type: acceptance
run_by: app/test/side-bar.test.tsx
links:
  proves: [LA-EXP-UC12-R03, LA-EXP-DR55]
---
Expects the spec file, the raw header fields and the raw links, and no children, problems or identity block; a record row with focus shows that record as "Selected" until focus leaves; a right-clicked row stays until a click elsewhere.
