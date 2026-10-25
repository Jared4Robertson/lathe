---
id: LA-PLT-C30
kind: component
title: Phone top bar and quick find sheet
parent: LA-PLT-LAY03
component_type: react component
file: app/src/shell/MobileBar.tsx
links:
  satisfies: [LA-PLT-UC08-R01, LA-PLT-UC08-R06, LA-PLT-DR17]
  depends_on: [LA-EXP-C17, LA-PLT-C13]
---
`TopBar`: the menu button, the page's title on one line under a link one step up (`pageHeading` works out both from the address), and quick find. `QuickFindSheet`: quick find as a full-screen dialog, its results a list under the box (`QuickFind` with `inline`), closing on a choice or Escape and giving focus back.
