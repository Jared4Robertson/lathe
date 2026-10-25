---
id: LA-BRW-C151
kind: component
title: Page tabs, kept per space and in the address
parent: LA-BRW-LAY06
component_type: react hook
file: app/src/views/useTabs.ts
links:
  reacts_to: [LA-BRW-EV01]
  satisfies: [LA-BRW-DR152, LA-BRW-DR153, LA-BRW-UC112-R05, LA-BRW-UC112-R06, LA-PAT-APP-CODE-R14]
  depends_on: [LA-BRW-C150, LA-BRW-C50]
---
`usePageTabs`: the focus page's tab sets, one per space, in session storage under `lathe:tabs`, each tab with its views, pane sizes, wiki scroll and graph settings. On each new address it opens the page in its tab set while rendering, so no frame shows the old tab's state, and it keeps the address naming the active tab: activating, cycling and closing move it. A space's first tab starts from the view, sizes and graph settings last used. The page bar shows the tabs as the tab strip on a wide screen and as the Open pages sheet on a phone.
