---
id: LA-BRW
kind: domain
title: Browsing
parent: LA
links:
  follows: [LA-PAT-APP-CODE, LA-PAT-APP-UX]
---
The web app's navigation of a product's specs: products and domains with their coverage and fitness, every record with its links followed both ways, and every problem. It reads the workspace from `GET /api/spec`, which calls the engine.

The spec pages only read. Records change in files, by a person or an agent, and the change is reviewed in git; the browser shows the result.
