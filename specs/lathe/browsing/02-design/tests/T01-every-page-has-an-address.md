---
id: LA-BRW-T01
kind: test
title: "Every page has its own address, and back and forward move between pages"
parent: LA-BRW
test_type: component
run_by: app/test/routing.test.tsx
links:
  proves: [LA-BRW-DR01]
---
Parses every spec address into its page, opens a record page directly from its address, follows menu links, and checks that the browser's back and forward buttons return to the earlier pages.
