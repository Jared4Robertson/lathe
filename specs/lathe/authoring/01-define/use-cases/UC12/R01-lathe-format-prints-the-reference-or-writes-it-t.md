---
id: LA-AUT-UC12-R01
kind: requirement
title: lathe format prints the reference, or writes it to a file
parent: LA-AUT-UC12
---
`lathe format` MUST print the reference as Markdown: the concepts from FORMAT.md, then the kinds, relations, folders and checks, each with its own anchor. With `--out <file>` it MUST write the same text to the file instead.
