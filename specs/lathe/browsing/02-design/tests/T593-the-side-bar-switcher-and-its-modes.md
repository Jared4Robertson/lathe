---
id: LA-BRW-T593
kind: test
title: The side bar's switcher, its headings, and its state per view mode and per tab across a reload
parent: LA-BRW
test_type: acceptance
run_by: app/test/side-bar.test.tsx
links:
  proves: [LA-BRW-UC119-R01, LA-BRW-UC119-R02, LA-PAT-APP-UX-R06]
---
Expects the side bar closed in the Wiki view and open on Details in the Graph view, a "Side bar views" group of three pressed-or-not buttons, each view under its heading, focus kept on the button pressed, Outline still chosen in the Graph view after a reload, and the Wiki view of the same tab still closed.
