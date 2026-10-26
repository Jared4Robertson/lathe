---
id: TL-LEND-API01
kind: api
title: Members
parent: TL-LEND
---
Registering members, at `/members`.

## Shapes

The request and response shapes its endpoints share, as JSON objects.

| Shape | Meaning | Fields |
| --- | --- | --- |
| Member | A registered member. | `id`, `name`, `email`, `joinedAt` |
| Error | Every refusal of every endpoint here. | `error` (a code such as `tool_on_loan`), `message` (a sentence) |
