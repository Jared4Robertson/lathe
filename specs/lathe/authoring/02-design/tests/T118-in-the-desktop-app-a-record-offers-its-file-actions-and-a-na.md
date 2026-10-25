---
id: LA-AUT-T118
kind: test
title: In the desktop app a record offers its file actions and a native menu, the page reports its errors, and full screen drops the traffic lights' room
parent: LA-AUT
test_type: component
run_by: app/test/desktop-record.test.tsx
links:
  proves: [LA-CHK-UC07-R02, LA-AUT-UC16-R01, LA-PLT-UC14-R12]
---
Opens a record in a browser and expects no record actions; then in the desktop app clicks Reveal in Finder, Open in editor and Copy ID; right-clicks the page title and a record link and expects the native menu asked for with their IDs, and elsewhere the page's own menu; expects the fixture's error count sent; switches full screen on and off and expects the title bar's room to follow; and finds records under nodes, links and titles.
