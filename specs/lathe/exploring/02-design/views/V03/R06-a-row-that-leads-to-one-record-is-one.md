---
id: LA-EXP-V03-R06
kind: interaction_requirement
title: A row that leads to one record is one link to it
parent: LA-EXP-V03
links:
  fulfills: [LA-EXP-UC02-R05]
---
A list row that leads to one record MUST hold exactly one link that stands for the whole row, and that link MUST be a real link (`<a href>`) to the record's page, so the row can be followed or opened in a new tab like any other reference. Other links in the row lead elsewhere and stay links of their own.
