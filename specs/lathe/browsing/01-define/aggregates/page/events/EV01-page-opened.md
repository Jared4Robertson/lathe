---
id: LA-BRW-EV01
kind: domain_event
title: Page opened
parent: LA-BRW-A1
links:
  raised_by: [LA-BRW-EN01]
---
The reader went to an address in the app, by a link, a command, the address bar or the back button, which opens its page with the views it names.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Address | The page's path and query. | App address. | /records/LA-MOD-A2?view=wiki,graph |
| Product | The product the page belongs to, which makes it the current space. | Product reference, or none. | LA |
| Focus | The record or group the page shows. | Record ID, group, or none. | LA-MOD-A2 |
| Views | The panes open on the page. | Wiki, Graph and Model, in order. | Wiki, Graph |
| Opened at | When the page opened. | Date and time. | 2026-10-24T14:05:00Z |
