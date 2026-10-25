---
id: LA
kind: product
title: Lathe
---
Lathe is a toolkit for organising a product's lifecycle (domain model, use cases, interaction design, technical design and tests) as structured records that a database checks and a web app navigates.

This product is Lathe's own specification, written in Lathe, so the tool is held to its own process. It has three domains:

- **Modeling** (`LA-MOD`): the CSV diagrams under `model/` and the Markdown spec records under `specs/`.
- **Checking** (`LA-CHK`): the engine that loads the workspace, applies the meta-model and checks, and computes coverage.
- **Browsing** (`LA-BRW`): the web app's navigation of specs, alongside the existing Diagrams pages.

The actors are **Jared**, who decides what Lathe is for and reviews its output, and **an AI agent**, which writes records and code on Jared's behalf. Following the people-and-tools foundation, an agent is a Tool acting for a Person, so every agent action traces back to Jared.

**How Lathe is delivered.** Lathe is a package, `@jaredrob/lathe`, installed into each product's own repo, where `lathe.config.json` names the product's specs and diagrams folders and any additions to the meta-model. One Lathe instance reads one product repo. The meta-model ships with Lathe as defaults and travels with the package; a product adds to it without forking. Lathe's own repo keeps Lathe's specification and the Tool Library example, because they are how Lathe is developed. Publishing the package waits until the record format settles, and needs Jared's approval. The Claude Code plugin comes before a CI action, because agents do most of the writing.

**How Lathe judges whether it is improving.** Following the foundation, only the person a tool serves judges its Fitness. Jared records that judgment as `fitness` records (a date, a score from 1 to 5, and the experiences behind it). Signals Lathe can count, such as coverage, open questions and checks, are shown as evidence beside the judgment and never become the score. Lathe never writes a fitness record itself.
