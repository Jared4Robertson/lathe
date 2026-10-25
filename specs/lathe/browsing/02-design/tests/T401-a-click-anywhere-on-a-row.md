---
id: LA-BRW-T401
kind: test
title: A click on a row opens its record, and a click on its chevron or second link does what that control does
parent: LA-BRW
test_type: unit
run_by: app/test/row-links.test.tsx
links:
  proves: [LA-BRW-UC03-R05]
---
On a domain page, a click on a row's padding reaches its stretched row link and opens the record. jsdom has no layout, so the test sends the click where the browser does: to the topmost element at that point, which is the link's `::after`, that is the link itself; the stylesheet rules that make this so are proved by `LA-BRW-T400`. The link is a real `href`, so Cmd/Ctrl-click is left to the browser and opens a new tab. A click on a row's fold chevron opens the row and stays on the page; a click on a second link in the row, a pattern's "followed by" use case, opens that use case instead. Right and Left arrow keys still open and close a tree row.
