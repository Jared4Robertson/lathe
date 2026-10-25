---
id: LA-PLT-T134
kind: test
title: Every box, badge and line an ERD draws is in the Model view key
parent: LA-PLT
test_type: unit
run_by: app/test/marks-have-meaning.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R21]
---
Draws the ERD of every domain, aggregate and entity of a workspace with entities and domain events, renders its key, and expects an entry, with words beside it, for each line's relation (dashed where the line is), each box's color, the event pill, the root badge, the highlight and the faded ring; and expects every class the stylesheet gives an ERD box or line to be one the test checks or one that only answers the pointer.
