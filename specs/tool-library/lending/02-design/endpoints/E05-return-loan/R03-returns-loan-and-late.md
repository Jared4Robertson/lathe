---
id: TL-LEND-E05-R03
kind: interaction_requirement
title: A return returns 200 with the loan and whether it was late
parent: TL-LEND-E05
links:
  fulfills: [TL-LEND-UC04-R04, TL-LEND-DR10]
---
A successful return MUST return 200 with the loan, including `dueDate`, `returnedAt`, `returnCondition`, `returnNote` and `late`: true when returned on a day after the due date in the library's time zone, otherwise false.
