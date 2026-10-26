---
id: TL-LEND-E05-R01
kind: interaction_requirement
title: A return body needs a condition of good or needs_repair
parent: TL-LEND-E05
links:
  fulfills: [TL-LEND-UC04-R01, TL-LEND-DR04]
---
The body MUST be `{ "condition": "good" | "needs_repair", "note"?: string }`. A missing or other condition MUST give 400 `invalid_condition`. A blank note is stored as none.
