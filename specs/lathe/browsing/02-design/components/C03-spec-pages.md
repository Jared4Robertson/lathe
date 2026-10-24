---
id: LA-BRW-C03
kind: component
title: Spec pages
parent: LA-BRW
component_type: react component
file: app/src/specs/SpecPages.tsx
links:
  implements: [LA-BRW-V02, LA-BRW-V03, LA-BRW-V04, LA-BRW-V05]
  satisfies: [LA-BRW-DR02, LA-BRW-DR03, LA-BRW-DR04, LA-BRW-UC01-R02, LA-BRW-UC01-R03, LA-BRW-UC02-R01, LA-BRW-UC02-R02, LA-BRW-UC02-R03, LA-BRW-UC03-R01, LA-BRW-UC03-R02, LA-BRW-UC03-R04, LA-BRW-UC04-R01]
  depends_on: [LA-BRW-C04, LA-BRW-C06, LA-BRW-C07, LA-BRW-C08, LA-BRW-C23]
---
The product, domain, record and checks pages, built from one fetched workspace. They only read it: the only input is the domain page's search box. Every record ID is shown through one link component, and the fixture note is shown above every page.
