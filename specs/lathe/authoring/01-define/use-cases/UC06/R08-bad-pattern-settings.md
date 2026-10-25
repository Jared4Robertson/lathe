---
id: LA-AUT-UC06-R08
kind: requirement
title: A pattern's setting that is not a valid field name is an error
parent: LA-AUT-UC06
---
The engine MUST report a `bad-pattern-settings` error for each setting name of a pattern that is not lower-case letters, digits and underscores starting with a letter, or that is one of the fields every record has (`id`, `kind`, `title`, `parent`, `links`). Such a name MUST NOT also be reported as missing from the use cases that follow the pattern.
