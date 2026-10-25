---
id: LA-BRW-C53
kind: component
title: Side navigation
parent: LA-BRW-LAY03
component_type: react component
file: app/src/shell/Nav.tsx
links:
  satisfies: [LA-BRW-UC50-R08, LA-BRW-UC50-R09, LA-BRW-DR53, LA-BRW-DR220, LA-BRW-UC116-R03]
  implements: [LA-BRW-V01]
  depends_on: [LA-BRW-C54, LA-BRW-C58]
---
The nav: header with the logo and the collapse toggle, quick find, the Diagrams, Specs and Tools sections that fold on their own, products whose domain lists fold, the current page marked and scrolled into view, quiet badges, and a footer with Appearance and the source of the specs; the rail of icons when collapsed, and a full-screen sheet on a narrow screen that keeps Tab inside it. Every row is one full-width `NavRow`, as in VS Code's explorer: indented by padding for its depth with its indent guides inside it, its chevron at its start, the current page's row carrying the selection over the whole row, hover tinting the whole row, and a 1 px outline on the selected row while the nav is used from the keyboard; on a coarse pointer the rows are 44 px tall.
