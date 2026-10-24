---
id: LA-BRW-C54
kind: component
title: Quick find
parent: LA-BRW
component_type: react component
file: app/src/shell/QuickFind.tsx
links:
  satisfies: [LA-BRW-UC50-R10]
  depends_on: [LA-BRW-C50]
---
A combobox that ranks every record, domain, product and diagram against what is typed (exact ID, ID prefix, title start, title word, anywhere) and opens the chosen one; arrow keys move, Enter opens, Escape clears.
