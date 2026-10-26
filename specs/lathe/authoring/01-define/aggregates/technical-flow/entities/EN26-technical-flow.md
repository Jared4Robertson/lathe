---
id: LA-AUT-EN26
kind: entity
title: Technical flow
parent: LA-AUT-A14
role: root
links:
  has_many: [LA-AUT-EN27]
  refers_to: [LA-AUT-EN18]
---
How the system carries out one flow.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the technical flow's number. | Text in the ID format. | LA-CHK-DF01 |
| Deepens | The flow it carries out. | Flow reference. | LA-CHK-F01 |
| Failure, limits and signals | What can go wrong, the limits it keeps and what it reports. | Tables in the body. | A check whose SQL fails is an error naming its file |
