---
id: LA-EXP-UC02-R06
kind: requirement
title: IDs cited in prose are links
parent: LA-EXP-UC02
---
In a rendered record body (a record page, and a product's or domain's overview), every ID in the record's `mentions` MUST become a link to the record's address, its bare ID (`/<id>`), wherever it appears in the text, with the record's title on hover, and a plain click MUST move within the app. An ID inside a code block, an existing link or a code span with other text MUST NOT be linked, nor part of a longer ID; a code span holding exactly one cited ID MUST link, as the engine reads it as a citation.
