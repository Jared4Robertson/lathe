---
id: LA-BRW-T423
kind: test
title: "A color below WCAG AA while editing gets a warning beside its swatch"
parent: LA-BRW
test_type: component
run_by: app/test/themes.test.tsx
links:
  proves: [LA-BRW-UC114-R05]
  covers: [LA-BRW-C195, LA-BRW-C196]
---
Sets the light muted text to a pale gray and expects warnings with the ratio on paper and on sheet in the light cell only, and a value that is not a color to be refused.
