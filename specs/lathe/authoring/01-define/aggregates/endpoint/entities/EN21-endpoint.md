---
id: LA-AUT-EN21
kind: entity
title: Endpoint
parent: LA-AUT-A9
role: root
links:
  refers_to: [LA-AUT-EN24]
---
One endpoint of a domain.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the endpoint's number. | Text in the ID format. | TL-LEND-E03 |
| Method and route | How it is called. | An HTTP method and a path. | POST /api/loans |
| API | The API of the resource it serves, when the domain groups its endpoints. | API reference, optional. | TL-LEND-API03 |
| Fulfills | The requirements it carries out. | List of requirement references. | TL-LEND-UC01-R02 |
