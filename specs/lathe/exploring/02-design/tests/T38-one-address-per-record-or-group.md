---
id: LA-EXP-T38
kind: test
title: A record and a group each have one address, in every view
parent: LA-EXP
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-EXP-UC05-R01, LA-EXP-DR08]
---
Parses record and group addresses at their bare IDs, builds the address of a record, a group and a domain, expects `?view=split` to name no view, then opens a record in the Graph view at its ID and a group page at its own address.
