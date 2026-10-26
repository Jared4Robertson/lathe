---
id: TL-LEND-E04-R01
kind: interaction_requirement
title: A borrow names a member and a tool that exist
parent: TL-LEND-E04
links:
  fulfills: [TL-LEND-UC03-R04]
---
The body MUST be `{ "memberId": number, "toolId": number }`, each a positive whole number; otherwise the response MUST be 400 `invalid_request`. When no member has that ID the response MUST be 404 `member_not_found`; when no tool has that ID, 404 `tool_not_found`.
