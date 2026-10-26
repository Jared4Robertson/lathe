---
id: TL-LEND-E07-R01
kind: interaction_requirement
title: Only a tool that exists and needs repair can be marked repaired
parent: TL-LEND-E07
links:
  fulfills: [TL-LEND-UC05-R02]
---
When no tool has that ID the response MUST be 404 `tool_not_found`. When the tool is in good condition it MUST be 409 `tool_not_damaged`.
