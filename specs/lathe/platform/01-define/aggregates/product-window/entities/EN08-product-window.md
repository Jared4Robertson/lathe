---
id: LA-PLT-EN08
kind: entity
title: Product window
parent: LA-PLT-A6
role: root
links:
  has_many: [LA-PLT-EN09]
---
One window showing one product folder.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Folder | The product folder it shows. | Folder path. | ~/Development/tool-library |
| Bounds | Its saved size and place. | x, y, width and height in screen points. | 120, 80, 1280, 840 |
| Server | Where it loads Lathe from. | App server reference. | serve() on port 61234 |
