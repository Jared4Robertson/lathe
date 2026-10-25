---
id: LA-CHK-DR30
kind: domain_rule
title: A file names an ID only as a whole ID
parent: LA-CHK-A5
---
When the engine looks for an ID in a file a record names, it MUST match the ID only as a whole ID: `TL-LEND-DR05` MUST NOT be found in the text `name TL-LEND-DR050` or `name TL-LEND-DR05-R01`. Otherwise a test could seem to prove a rule its file never names.
