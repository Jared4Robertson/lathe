---
id: LA-PLT-T94
kind: test
title: "Accessibility: every page and state passes axe at WCAG 2.2 AA, at both widths, in every look"
parent: LA-PLT
test_type: acceptance
run_by: app/a11y/audit.spec.ts
links:
  proves: [LA-PLT-UC09-R01, LA-PLT-DR21, LA-PLT-DR22, LA-PLT-DR23, LA-PLT-DR24, LA-PLT-DR25, LA-PAT-APP-UX-R10]
---
Opens each page and state (the product, domain, record and group pages, the graph, the Model view, Checks, Format, Appearance, quick find, the palette, the shortcuts sheet, a tooltip, the nav drawer, the quick find sheet and the side bar sheet) at 1440 px and 375 px, in Lathe and High contrast, light and dark, and expects axe-core to find nothing.
