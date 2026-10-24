---
id: TL-LEND-E01-R03
kind: interaction_requirement
title: A registration returns 201 with the new member
parent: TL-LEND-E01
links:
  fulfills: [TL-LEND-UC01-R03]
---
A successful registration MUST return 201 with the member: `id` (a whole number), `name` (trimmed), `email` (trimmed, lower case) and `joinedAt` (an ISO 8601 time).
