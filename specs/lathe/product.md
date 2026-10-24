---
id: LA
kind: product
title: Lathe
---
Lathe is a toolkit for organising a product's lifecycle (domain model, use cases, interaction design, technical design and tests) as structured records that a database checks and a web app navigates.

This product is Lathe's own specification, written in Lathe, so the tool is held to its own process. It has three domains:

- **Modelling** (`LA-MOD`): the CSV diagrams under `model/` and the Markdown spec records under `specs/`.
- **Checking** (`LA-CHK`): the engine that loads the workspace, applies the meta-model and checks, and computes coverage.
- **Browsing** (`LA-BRW`): the web app's navigation of specs, alongside the existing Diagrams pages.

The actors are **Jared**, who decides what Lathe is for and reviews its output, and **an AI agent**, which writes records and code on Jared's behalf. Following the people-and-tools foundation, an agent is a Tool acting for a Person, so every agent action traces back to Jared.

Requirements with no test yet are left unproved on purpose: they show as coverage gaps, which is the honest state of the design.
