---
id: LA-CHK-EV03
kind: domain_event
title: Workspace checked
parent: LA-CHK-A2
links:
  raised_by: [LA-CHK-EN06]
---
The engine loaded a product's records and ran every check over them, for `lathe check`, for code that loads the workspace or for `GET /api/spec`.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Specs folder | The folder that was loaded. | Folder path. | specs |
| Records | How many records were loaded. | Whole number. | 1523 |
| Errors | How many problems are errors. | Whole number. | 0 |
| Warnings | How many problems are warnings. | Whole number. | 4 |
| Checked at | When the load finished. | Date and time. | 2026-10-24T14:02:01Z |
