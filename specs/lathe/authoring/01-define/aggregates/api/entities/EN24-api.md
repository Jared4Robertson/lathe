---
id: LA-AUT-EN24
kind: entity
title: API
parent: LA-AUT-A15
role: root
---
One API of a domain: the endpoints for one resource.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the API's number. | Text in the ID format. | TL-LEND-API03 |
| Title | The resource it serves. | Text. | Loans |
| Shapes | The request and response shapes its endpoints share. | A table in the body. | Loan: `id`, `memberId`, `toolId` |
