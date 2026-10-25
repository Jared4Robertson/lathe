---
id: LA-EXP-C01
kind: component
title: Spec pages
parent: LA-EXP-LAY06
component_type: react component
file: app/src/specs/SpecPages.tsx
links:
  implements: [LA-TRC-V01, LA-EXP-V02, LA-EXP-V03, LA-CHK-V01]
  satisfies: [LA-EXP-V03-R01, LA-EXP-DR02, LA-EXP-DR03, LA-TRC-UC09-R02, LA-TRC-UC09-R03, LA-EXP-UC01-R01, LA-EXP-UC01-R02, LA-EXP-UC01-R03, LA-EXP-UC02-R01, LA-EXP-UC02-R02, LA-EXP-UC02-R04, LA-CHK-UC07-R01]
  depends_on: [LA-TRC-C36, LA-PLT-C07, LA-EXP-C02, LA-AUT-C64, LA-EXP-C06]
---
The product, domain, record and checks pages, built from one fetched workspace. They only read it: the only input is the domain page's search box. Every record ID is shown through one link component, and the fixture note is shown above every page.
