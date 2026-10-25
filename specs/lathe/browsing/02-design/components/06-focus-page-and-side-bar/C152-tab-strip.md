---
id: LA-BRW-C152
kind: component
title: Tab strip
parent: LA-BRW-LAY06
component_type: react component
file: app/src/views/TabStrip.tsx
links:
  satisfies: [LA-BRW-UC112-R02, LA-BRW-UC112-R04, LA-BRW-UC112-R07, LA-BRW-DR320, LA-BRW-DR321, LA-BRW-UC120-R02]
  depends_on: [LA-BRW-C151, LA-BRW-C105]
---
The `tablist` at the left of the page bar: one `tab` per open page with its ID in mono and its title (a group's label), the preview's title italic, and a tooltip with both in full; the tab is named by what it shows. Beside each tab, never inside it, sits its close button, for the pointer only and hidden from the accessibility tree, since a tablist holds only tabs. Click activates, double-click keeps, middle-click closes; on the focused strip the arrow keys, Home and End move, Enter or Space activates and Delete closes. It scrolls sideways under the wheel and brings the active tab into view.
