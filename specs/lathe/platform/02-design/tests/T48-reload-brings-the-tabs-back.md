---
id: LA-PLT-T48
kind: test
title: Reloading brings back the same tabs, the preview, the active tab and each tab's views
parent: LA-PLT
test_type: component
run_by: app/test/record-tabs.test.tsx
links:
  proves: [LA-PAT-APP-UX-R06, LA-EXP-UC10-R06]
---
Opens three tabs, two kept and one preview, with different views, activates the first, and reloads the app at the same address: expects the same tabs in order, the same preview and active tab, the first tab's two panes, and the second tab's wiki alone when activated.
