---
id: LA-PLT-T46
kind: test
title: Clicking a box goes to it, boxes show a hover state, and a key under the diagram explains the colors with emoji squares and the line ends
parent: LA-PLT
test_type: component
run_by: app/test/model.test.tsx
links:
  proves: [LA-EXP-UC11-R05, LA-PAT-APP-UX-R01]
---
Opens a domain with the wiki and model, expects the key under the diagram with 🟦 and ⬜ and the line ends, clicks an aggregate's box and expects its page with the same views, presses Enter on an entity's box and expects its page, and expects the hover ring, its speed and the colors as tokens in the stylesheet.
