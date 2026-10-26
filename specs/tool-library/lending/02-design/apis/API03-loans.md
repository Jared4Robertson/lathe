---
id: TL-LEND-API03
kind: api
title: Loans
parent: TL-LEND
---
Borrowing and returning, at `/loans`.

## Shapes

The request and response shapes its endpoints share, as JSON objects.

| Shape | Meaning | Fields |
| --- | --- | --- |
| Loan | One member holding one tool. | `id`, `memberId`, `toolId`, `borrowedAt`, `dueDate`, `returnedAt`, `returnCondition`, `returnNote` |
| Error | Every refusal of every endpoint here. | `error` (a code such as `tool_on_loan`), `message` (a sentence) |
