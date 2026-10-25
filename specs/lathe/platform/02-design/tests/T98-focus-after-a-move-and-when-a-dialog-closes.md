---
id: LA-PLT-T98
kind: test
title: "Accessibility: focus after a move, and back on the opener when a dialog or a sheet closes"
parent: LA-PLT
test_type: acceptance
run_by: app/a11y/keyboard.spec.ts
links:
  proves: [LA-PLT-UC09-R03, LA-PAT-APP-UX-R10]
---
Expects focus to stay on the page after quick find opens a record, to stay on a view toggle and the side bar toggle after they are pressed, and to follow the box that became the graph's center. Opens the palette, the shortcuts sheet and the theme picker, expects focus inside each and Tab to stay inside, and expects focus back on the opener when each closes; at 375 px does the same for the nav drawer and the side bar sheet.
