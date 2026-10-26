---
id: LA-AUT-EN25
kind: entity
title: Integration
parent: LA-AUT-A13
role: root
---
One outside system a domain exchanges with.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| ID | The domain's ID and the integration's number. | Text in the ID format. | SHOP-PAY-INT01 |
| System | The outside system it exchanges with. | Text, optional. | Card provider |
| Exchanges | What passes each way, one interaction requirement each. | The interaction requirements under it. | SHOP-PAY-INT01-R01 |
