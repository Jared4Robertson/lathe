---
id: LA-BRW-UC60-R06
kind: requirement
title: IDs cited in prose are links
parent: LA-BRW-UC60
---
In a rendered record body (a record page, and a product's or domain's overview), every ID in the record's `mentions` MUST become a link to `/records/<id>` wherever it appears in the text, with the record's title on hover, and a plain click MUST move within the app. An ID inside a code span, a code block or an existing link MUST NOT be linked, nor part of a longer ID. A record without `mentions` (from an older engine) MUST be shown with no mention links.
