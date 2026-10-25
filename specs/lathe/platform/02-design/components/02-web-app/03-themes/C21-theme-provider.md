---
id: LA-PLT-C21
kind: component
title: Theme provider
parent: LA-PLT-LAY05
component_type: react component
file: app/src/theme/ThemeProvider.tsx
links:
  reacts_to: [LA-PLT-EV01, LA-PLT-EV02]
  satisfies: [LA-PLT-UC06-R02, LA-PLT-UC06-R06, LA-PLT-UC06-R07, LA-PLT-DR14, LA-PLT-DR15, LA-PLT-UC08-R09]
  depends_on: [LA-PLT-C19, LA-PLT-C20]
---
Holds the themes, the chosen one and the mode; applies what shows and keeps what is chosen; previews without keeping; duplicates, updates, resets, deletes, imports and exports themes.
