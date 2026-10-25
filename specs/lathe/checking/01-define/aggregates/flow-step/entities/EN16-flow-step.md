---
id: LA-CHK-EN16
kind: entity
title: Flow step
parent: LA-CHK-A7
role: root
links:
  refers_to: [LA-MOD-EN04]
---
One step of a flow: its place, what it goes through and what it carries out.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Step | The step's record. | Record reference. | TL-LEND-F02-S02 |
| Flow | The flow it is a step of. | Record reference. | TL-LEND-F02 |
| Order | Its place in the flow. | Whole number, unique in the flow. | 2 |
| Uses | The views, endpoints or components it goes through. | List of record references. | TL-LEND-V01, TL-LEND-E03 |
| Fulfills | The requirements and rules it carries out, all inside its flow. | List of record references. | TL-LEND-DR05 |
