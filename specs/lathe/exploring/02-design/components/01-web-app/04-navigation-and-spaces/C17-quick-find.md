---
id: LA-EXP-C17
kind: component
title: Quick find
parent: LA-EXP-LAY05
component_type: react component
file: app/src/shell/QuickFind.tsx
links:
  satisfies: [LA-EXP-UC05-R10]
  depends_on: [LA-EXP-C13]
---
A combobox that ranks every record, domain and product against what is typed (exact ID, ID prefix, title start, title word, anywhere) and opens the chosen one; arrow keys move, Enter opens, Escape clears.
