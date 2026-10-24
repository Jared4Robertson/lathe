---
id: TL-LEND-C03
kind: component
title: member-service.ts
parent: TL-LEND
component_type: service
file: examples/tool-library/src/member-service.ts
links:
  satisfies: [TL-LEND-DR01, TL-LEND-UC01-R01, TL-LEND-UC01-R02, TL-LEND-UC01-R03, TL-LEND-E01-R01, TL-LEND-E01-R02, TL-LEND-E01-R03, TL-PAT-LIBRARIAN-ACTION-R01]
  depends_on: [TL-LEND-C01, TL-LEND-C02]
---
Registers members: trims the name, validates and lower-cases the email, refuses a duplicate email, and returns the new member. A missing name or email is refused with a message naming it before anything is saved (the Librarian action pattern's rule R01).
