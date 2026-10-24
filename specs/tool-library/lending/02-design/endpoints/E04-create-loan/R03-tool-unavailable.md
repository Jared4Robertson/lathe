---
id: TL-LEND-E04-R03
kind: interaction_requirement
title: An unavailable tool is refused with 409 and the reason
parent: TL-LEND-E04
links:
  fulfills: [TL-LEND-UC03-R02, TL-LEND-DR05, TL-LEND-DR06]
---
When the tool needs repair the response MUST be 409 `tool_needs_repair`. When the tool is on loan it MUST be 409 `tool_on_loan`.
