---
id: LA-AUT-UC07
kind: use_case
title: Cite records by the IDs a product writes
parent: LA-AUT-CAP01
actor: Owner, Agent
links:
  applies: [LA-AUT-DR27, LA-AUT-DR28, LA-AUT-DR29, LA-AUT-DR30, LA-AUT-DR31]
---
A product's IDs do not always start with the product's ID. A real product's records may be `ACC-UC01`, `STD-04` and `SYS-C01`, so when only IDs with a product prefix were read, none of its citations were checked, while the bare product ID in any body counted as one. The person runs `lathe check`; the engine reads as a citation every token that is a record's ID, and every token that starts with a known prefix (a product's or a domain's ID, or an entry of `idPrefixes` in `lathe.config.json`). A bare product or domain ID counts only when written as a code span of its own. Only a token with a known prefix that no record has is reported as an unknown ID, so the warnings stay about real drift.
