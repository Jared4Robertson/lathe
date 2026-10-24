---
id: LA-MOD-A2
kind: aggregate
title: Record
parent: LA-MOD
links:
  relates_to: [LA-CHK-A1]
---
One specification record: a Markdown file under `specs/` with a YAML header (`id`, `kind`, `title`, `parent`, kind fields, `links`) and a prose body. A record's outgoing links belong to it: a **link** is a relation name and a target record ID, held in the record's `links` map.

Every `*.md` file under `specs/` is a record, except files named `README.md`. Folder names are for people; only the record's fields carry meaning.

The record's kind, and the relations its links may use, are governed by the meta-model (`LA-CHK-A1`).

A record has no status field, unlike a diagram term. A record in the specs is in force; anything uncertain is an open question (`kind: question`), and git keeps the history. Checks and coverage treat every record the same way.
