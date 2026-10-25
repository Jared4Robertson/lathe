---
id: LA-AUT-UC12-R05
kind: requirement
title: A title that does not read as past tense is a warning
parent: LA-AUT-UC12
---
A domain event whose title has no past form as its last word or after its first, by a heuristic of "-ed" endings and a documented list of irregular past forms kept in the check, MUST be an `event-tense` warning.
