---
id: LA-BRW-C311
kind: component
title: Surfaces, targets and scroll boxes
parent: LA-BRW-LAY08
component_type: stylesheet
file: app/src/styles.css
links:
  satisfies: [LA-BRW-DR322, LA-BRW-DR323, LA-BRW-DR324]
---
The shared styles and attributes behind the accessibility audit's fixes: a page that is one panel (`.spec-page.panel`) draws `--paper` so text never sits on the shell; record links listed in a traceability cell are 24 px tall; and a box that scrolls with nothing focusable in it (a Markdown code block, the Format page's example header, the shortcuts sheet's groups, the ERD's key, the graph's trail) takes `tabindex="0"` and a name.
