---
id: LA-CHK-EV04
kind: domain_event
title: Format reference generated
parent: LA-CHK-A12
links:
  raised_by: [LA-CHK-EN21]
---
`lathe format` wrote a product's format reference from its meta-model and its checks, to standard output or to a file.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Product | Whose format it documents. | Product reference. | LA |
| Output | Where the reference was written. | File path, or standard output. | lathe/REFERENCE.md |
| Kinds | How many kinds it documents. | Whole number. | 21 |
| Checks | How many checks it documents. | Whole number. | 59 |
| Generated at | When it was written. | Date and time. | 2026-10-24T14:30:00Z |
