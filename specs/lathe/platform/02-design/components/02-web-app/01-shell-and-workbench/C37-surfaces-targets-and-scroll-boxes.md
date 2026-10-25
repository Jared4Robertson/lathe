---
id: LA-PLT-C37
kind: component
title: Surfaces, targets and scroll boxes
parent: LA-PLT-LAY03
component_type: stylesheet
file: app/src/styles.css
links:
  satisfies: [LA-PLT-DR23, LA-PLT-DR24, LA-PLT-DR25]
---
The shared styles and attributes behind the accessibility audit's fixes: a page that is one panel (`.spec-page.panel`) draws `--paper` so text never sits on the shell; record links listed in a traceability cell (`app/src/styles.css`) or in the side bar's Details (`app/src/views/SideBar.css`) are 24 px tall; and a box that scrolls with nothing focusable in it (a Markdown code block, the Format page's example header, the shortcuts sheet's groups, the ERD's key, the graph's trail) takes `tabindex="0"` and a name.
