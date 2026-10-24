---
id: LA-CHK-UC01-R06
kind: requirement
title: A fitness record's date and score are checked
parent: LA-CHK-UC01
---
The engine MUST report an error `bad-fitness-date` when a `fitness` record's `date` is not a real calendar date written `YYYY-MM-DD`, and an error `bad-fitness-score` when its `score` is not a whole number from 1 to 5. A missing date or score is a `missing-required-field` error. Plain header values are read as text, so `score: 4` and `score: "4"` are the same.
