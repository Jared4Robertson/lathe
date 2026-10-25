---
id: LA-BRW-C212
kind: component
title: Phone top bar and quick find sheet
parent: LA-BRW-LAY02
component_type: react component
file: app/src/shell/MobileBar.tsx
links:
  satisfies: [LA-BRW-UC116-R01, LA-BRW-UC116-R06, LA-BRW-DR223]
  depends_on: [LA-BRW-C54, LA-BRW-C62]
---
`TopBar`: the menu button, the page's title on one line under a link one step up (`pageHeading` works out both from the address), and quick find. `QuickFindSheet`: quick find as a full-screen dialog, its results a list under the box (`QuickFind` with `inline`), closing on a choice or Escape and giving focus back.
