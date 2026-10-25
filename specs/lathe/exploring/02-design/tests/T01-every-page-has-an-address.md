---
id: LA-EXP-T01
kind: test
title: Every page has its own address, and back and forward move between pages
parent: LA-EXP
test_type: component
run_by: app/test/routing.test.tsx
links:
  proves: [LA-EXP-DR01]
---
Parses every spec address into its page, and an old one as missing, opens a record page directly from its address, follows menu links, and checks that the browser's back and forward buttons return to the earlier pages.
