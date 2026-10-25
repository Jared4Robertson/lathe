---
id: LA-PLT-T68
kind: test
title: No page scrolls sideways at 320 px
parent: LA-PLT
test_type: component
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-UX-R07, LA-PLT-UC07-R01, LA-PLT-UC07-R08]
---
Reads the stylesheet for any fixed least width over 288 px outside a wide-screen query, checks that tables and code blocks scroll in their own box and that IDs wrap, and renders the product, domain, record, component, checks and format pages on a phone expecting every table and code block in a scrolling box and no inline width over 288 px. jsdom lays nothing out, so the real widths are checked in a browser at 320 and 375 px.
