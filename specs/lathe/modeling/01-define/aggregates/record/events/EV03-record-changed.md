---
id: LA-MOD-EV03
kind: domain_event
title: Record changed
parent: LA-MOD-A2
links:
  raised_by: [LA-MOD-EN04]
---
A record file under the specs folder was saved, added or removed, by a person in an editor or by an agent, which the server announces as `spec:changed`.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Specs folder | The product's specs folder that changed. | Folder path. | specs |
| File | The record file that changed. | File path. | lathe/modeling/01-define/aggregates/A2-record.md |
| Change | What happened to the file. | `added`, `changed` or `removed`. | changed |
| Changed at | When the change was seen. | Date and time. | 2026-10-24T14:02:00Z |
