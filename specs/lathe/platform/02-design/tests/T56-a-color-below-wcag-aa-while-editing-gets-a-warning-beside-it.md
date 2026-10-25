---
id: LA-PLT-T56
kind: test
title: A color below WCAG AA while editing gets a warning beside its swatch
parent: LA-PLT
test_type: component
run_by: app/test/themes.test.tsx
links:
  proves: [LA-PLT-UC07-R05]
  covers: [LA-PLT-C25, LA-PLT-C26]
---
Sets the light muted text to a pale gray and expects warnings with the ratio on paper and on sheet in the light cell only, and a value that is not a color to be refused.
