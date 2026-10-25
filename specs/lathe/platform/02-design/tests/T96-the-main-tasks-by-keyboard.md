---
id: LA-PLT-T96
kind: test
title: "Accessibility: the main tasks by keyboard alone, with their announcements"
parent: LA-PLT
test_type: acceptance
run_by: app/a11y/keyboard.spec.ts
links:
  proves: [LA-PLT-UC09-R02, LA-PLT-UC09-R04, LA-PAT-APP-UX-R10]
---
With the keyboard only: follows the skip link, opens a record from the nav and from quick find, turns the Graph view on and off from the page bar, moves between the graph's boxes and re-centers on one, folds and unfolds a row, hides, shows and focuses the side bar, and picks the Midnight theme; and expects the announcer to say "Graph view", "Side bar hidden", "Side bar shown" and "Color theme: Midnight".
