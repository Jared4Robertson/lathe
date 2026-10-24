---
id: TL-LEND-E02-R01
kind: interaction_requirement
title: A tool body needs a name
parent: TL-LEND-E02
links:
  fulfills: [TL-LEND-UC02-R01]
---
The body MUST be `{ "name": string, "description"?: string }`. The name is trimmed and MUST NOT be blank, or the response MUST be 400 `invalid_request`. A missing description is stored as an empty string.
