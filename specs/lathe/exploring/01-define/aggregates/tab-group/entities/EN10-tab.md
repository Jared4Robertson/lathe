---
id: LA-EXP-EN10
kind: entity
title: Tab
parent: LA-EXP-A5
role: child
links:
  refers_to: [LA-EXP-EN01]
---
One open page, with what it shows and where the reader was in it.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Page | The page it holds, by its address path. | Page reference, without the views. | /LA-EXP-UC10 |
| Preview | Whether the next plain open replaces it. | Yes or no; at most one tab of a group says yes. | Yes |
| Views | The views it has open, those its page does not offer included. | `wiki`, `graph` and `model`, in pane order. | wiki,graph |
| Pane sizes | Each pane's weight, which the gaps share out. | Whole number per view, 1 to 10000. | wiki 160, graph 40 |
| Wiki scroll | How far down the wiki pane was. | Pixels from the top. | 120 |
| Graph settings | The graph's depth, trace, filters and open groups. | Depth 1 to 3, yes or no, kinds and relations hidden, groups open. | Depth 2 |
