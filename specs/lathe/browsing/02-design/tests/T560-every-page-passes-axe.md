---
id: LA-BRW-T560
kind: test
title: "Accessibility: every page and state passes axe at WCAG 2.2 AA, at both widths, in every look"
parent: LA-BRW
test_type: acceptance
run_by: app/a11y/audit.spec.ts
links:
  proves: [LA-BRW-UC120-R01, LA-BRW-DR320, LA-BRW-DR321, LA-BRW-DR322, LA-BRW-DR323, LA-BRW-DR324, LA-PAT-APP-UX-R10]
---
Opens each page and state (the product, domain, record and group pages, the graph, the Model view, Checks, Format, Appearance, quick find, the palette, the shortcuts sheet, a tooltip, the nav drawer, the quick find sheet and the inspector sheet) at 1440 px and 375 px, in Lathe and High contrast, light and dark, and expects axe-core to find nothing.
