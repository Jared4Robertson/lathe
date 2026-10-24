---
id: TL-LEND-E06-R01
kind: interaction_requirement
title: A damage report needs a note and a tool that exists
parent: TL-LEND-E06
links:
  fulfills: [TL-LEND-UC05-R01]
---
The body MUST be `{ "note": string }` with a note that is not blank, or the response MUST be 400 `invalid_request`. When no tool has that ID the response MUST be 404 `tool_not_found`.
