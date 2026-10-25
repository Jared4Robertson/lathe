---
id: LA-BRW-T471
kind: test
title: A selected row is the whole row
parent: LA-BRW
test_type: component
run_by: app/test/nav.test.tsx
links:
  proves: [LA-BRW-DR220]
---
Opens a domain page and a record page and expects one selected nav row each, the row holding the current link (and the domain's fold chevron), indented by its depth; and in the stylesheet the row spanning the panel with padding for its depth, the selection tint and steel text, no inset bar, no indent from the lists, the whole-row hover tint and the 1 px keyboard outline.
