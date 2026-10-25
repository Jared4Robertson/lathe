---
id: LA-EXP-T04
kind: test
title: The search box filters records by ID or title as you type
parent: LA-EXP
test_type: component
run_by: app/test/domain-page.test.tsx
links:
  proves: [LA-EXP-UC01-R02]
---
Types a title fragment and an ID fragment into the search box and checks which records stay shown, then clears it and checks that every record is back.
