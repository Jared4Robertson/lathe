---
id: TL-LEND-C04
kind: component
title: tool-service.ts
parent: TL-LEND-LAY02
component_type: service
file: examples/tool-library/src/tool-service.ts
links:
  satisfies: [TL-LEND-DR04, TL-LEND-UC02-R01, TL-LEND-UC02-R02, TL-LEND-UC05-R01, TL-LEND-UC05-R02, TL-LEND-UC05-R03, TL-LEND-E02-R01, TL-LEND-E02-R02, TL-LEND-E03-R01, TL-LEND-E06-R01, TL-LEND-E06-R02, TL-LEND-E07-R01, TL-LEND-E07-R02, TL-PAT-LIBRARIAN-ACTION-R01]
  depends_on: [TL-LEND-C01, TL-LEND-C02]
---
The catalog: adds tools in good condition, lists them with their status, marks a tool as needing repair (with a required note, leaving any loan alone), and marks a damaged tool repaired. A missing tool name or damage note is refused with a message naming it before anything is saved (the Librarian action pattern's rule R01).
