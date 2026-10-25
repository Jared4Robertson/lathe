---
id: LA-CHK-UC03-R02
kind: requirement
title: IDs in code are not citations, except a code span holding one lone ID
parent: LA-CHK-UC03
---
The engine MUST NOT read citations from fenced code blocks (opened by three or more backticks or tildes) or from inline code spans that hold anything besides one ID, so that an example ID can be written in code. An inline code span holding exactly one ID and nothing else MUST be read as a citation, because writers often format IDs that way.
