---
id: LA-EXP-T08
kind: test
title: A record body is sanitized before it is shown
parent: LA-EXP
test_type: component
run_by: app/test/record-page.test.tsx
links:
  proves: [LA-EXP-UC02-R03]
---
Renders a body holding a script, an image with an onerror handler and a javascript: link, and checks that none of them reaches the page or runs.
