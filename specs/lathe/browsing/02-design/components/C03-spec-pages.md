---
id: LA-BRW-C03
kind: component
title: Spec pages
parent: LA-BRW
component_type: react component
file: app/src/specs/SpecPages.tsx
links:
  implements: [LA-BRW-V02, LA-BRW-V03, LA-BRW-V04, LA-BRW-V05]
  satisfies: [LA-BRW-DR02, LA-BRW-DR03, LA-BRW-UC01-R02, LA-BRW-UC01-R03, LA-BRW-UC02-R01, LA-BRW-UC02-R02, LA-BRW-UC02-R03, LA-BRW-UC03-R01, LA-BRW-UC03-R02, LA-BRW-UC03-R03, LA-BRW-UC03-R04, LA-BRW-UC04-R01]
  depends_on: [LA-BRW-C01]
---
The product, domain, record and checks pages, built from one fetched workspace. Record bodies are rendered with `marked` and sanitised with `dompurify`.