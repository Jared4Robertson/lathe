---
id: LA-BRW-T500
kind: test
title: Actions look like actions on the main pages
parent: LA-BRW
test_type: component
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-UX-R09, LA-BRW-DR260]
---
Renders the products, product, domain, record, graph, checks, format and appearance pages and expects no `button.secondary` or `.tree-bulk`, no paragraph whose only content is a plain link (a standalone link must be drawn as a button; a record's own ID line is a reference), and every `<button>` to be the `Button` component's or one of the allowed controls: tab close buttons, toggles in a group, fold chevrons, the nav's rows and rail, the sheet handle, the open-pages list and the title bar's command center. Then reads the source for the same: no `secondary` or `tree-bulk` class, and every raw `<button>` outside `Button.tsx` one of those controls.
