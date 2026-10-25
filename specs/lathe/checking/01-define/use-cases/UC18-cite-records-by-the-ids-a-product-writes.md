---
id: LA-CHK-UC18
kind: use_case
title: Cite records by the IDs a product writes
parent: LA-CHK-CAP01
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR120, LA-CHK-DR121, LA-CHK-DR122, LA-CHK-DR123, LA-CHK-DR124]
---
A product's IDs do not always start with the product's ID. S2's records are `ACC-UC01`, `STD-04` and `SYS-C01`, so when only IDs with a product prefix were read, none of S2's citations were checked, while the bare word S2 in any body counted as one. The person runs `lathe check`; the engine reads as a citation every token that is a record's ID, and every token that starts with a known prefix (a product's or a domain's ID, or an entry of `idPrefixes` in `lathe.config.json`). A bare product or domain ID counts only when written as a code span of its own. Only a token with a known prefix that no record has is reported as an unknown ID, so the warnings stay about real drift.
