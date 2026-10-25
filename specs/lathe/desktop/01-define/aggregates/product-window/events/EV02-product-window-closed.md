---
id: LA-DSK-EV02
kind: domain_event
title: Product window closed
parent: LA-DSK-A1
---
A product window closed, by the reader or because the shell quit, with its size and place saved for the next time.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Folder | The product folder the window showed. | Folder path. | ~/Development/Lathe |
| Bounds | Where the window was and how big. | Position and size, and whether it was maximized or full screen. | 120, 80, 1440 by 900, not maximized |
| Closed at | When the window closed. | Date and time. | 2026-10-24T18:00:00Z |
