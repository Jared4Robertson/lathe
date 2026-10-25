---
id: LA-EXP-C44
kind: component
title: Page tabs, kept per space and in the address
parent: LA-EXP-LAY08
component_type: react hook
file: app/src/views/useTabs.ts
links:
  reacts_to: [LA-EXP-EV01]
  satisfies: [LA-EXP-DR34, LA-EXP-DR35, LA-EXP-UC10-R05, LA-EXP-UC10-R06, LA-PAT-APP-UX-R06]
  depends_on: [LA-EXP-C43, LA-EXP-C13]
---
`usePageTabs`: the focus page's tab sets, one per space, in session storage under `lathe:tabs`, each tab with its views, pane sizes, wiki scroll and graph settings. On each new address it opens the page in its tab set while rendering, so no frame shows the old tab's state, and it keeps the address naming the active tab: activating, cycling and closing move it. A space's first tab starts from the view, sizes and graph settings last used. The page bar shows the tabs as the tab strip on a wide screen and as the Open pages sheet on a phone.
