---
id: LA-EXP-C16
kind: component
title: Side navigation
parent: LA-EXP-LAY05
component_type: react component
file: app/src/shell/Nav.tsx
links:
  satisfies: [LA-EXP-UC05-R08, LA-EXP-UC05-R09, LA-PLT-DR03, LA-EXP-DR41, LA-PLT-UC07-R03, LA-PLT-UC08-R01, LA-PLT-UC08-R02, LA-PLT-DR21]
  implements: [LA-EXP-V01]
  depends_on: [LA-EXP-C17, LA-PLT-C08]
---
The nav: header with the logo and the collapse toggle, quick find, the Specs and Tools sections that fold on their own, products whose domain lists fold, the current page marked and scrolled into view, quiet badges, and a footer with Appearance and the source of the specs; the rail of icons when collapsed, and a full-screen sheet on a narrow screen that keeps Tab inside it. Every row is one full-width `NavRow`, as in VS Code's explorer: indented by padding for its depth with its indent guides inside it, its chevron at its start, the current page's row carrying the selection over the whole row, hover tinting the whole row, and a 1 px outline on the selected row while the nav is used from the keyboard; on a coarse pointer the rows are 44 px tall.
