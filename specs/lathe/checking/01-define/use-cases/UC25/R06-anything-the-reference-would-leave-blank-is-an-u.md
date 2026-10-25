---
id: LA-CHK-UC25-R06
kind: requirement
title: Anything the reference would leave blank is an undocumented error
parent: LA-CHK-UC25
---
`lathe check` MUST report an `undocumented` error for a kind with an empty description, a relation rule with an empty description, and a check file, Lathe's or the product's, whose header lacks its summary sentence, explanation or severity line.
