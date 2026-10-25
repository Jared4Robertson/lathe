---
id: LA-PLT-T79
kind: test
title: Actions look like actions on the main pages
parent: LA-PLT
test_type: component
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-UX-R09, LA-PLT-DR20]
---
Renders the products, product, domain, record, graph, checks, format and appearance pages and expects no `button.secondary` or `.tree-bulk`, no paragraph whose only content is a plain link (a standalone link must be drawn as a button; a record's own ID line is a reference), and every `<button>` to be the `Button` component's or one of the allowed controls: tab close buttons, toggles in a group, fold chevrons, the nav's rows and rail, the sheet handle, the open-pages list, the title bar's command center and the canvas library's zoom controls. Then reads the source for the same: no `secondary` or `tree-bulk` class, and every raw `<button>` outside `Button.tsx` one of those controls, none taking the Button's own classes except the view toggles, which take the icon look on a wide screen and a segment's on a phone.
