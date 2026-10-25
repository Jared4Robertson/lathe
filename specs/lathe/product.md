---
id: LA
kind: product
title: Lathe
actors: Owner Reader Agent
---
Lathe is a toolkit for organizing a product's lifecycle (domain model, use cases, interaction design, technical design and tests) as structured records that a database checks and a web app navigates.

This product is Lathe's own specification, written in Lathe, so the tool is held to its own process. It has four domains:

- **Modeling** (`LA-MOD`): the CSV diagrams under `model/` and the Markdown spec records under `specs/`.
- **Checking** (`LA-CHK`): the engine that loads the workspace, applies the meta-model and checks, and computes coverage.
- **Browsing** (`LA-BRW`): the web app's navigation of specs, alongside the existing Diagrams pages.
- **Desktop** (`LA-DSK`): Lathe as a desktop app, a window per product folder around the same web app.

Lathe's use cases name three roles. The **Owner** is the person who decides what a product is for, reviews agents' work and records the product's fitness. A **Reader** is anyone using the app to read and navigate a spec, such as a teammate or the owner. An **Agent** is an AI agent that writes records and code on someone's behalf. Following the people-and-tools foundation, an agent is a Tool acting for a Person, so every agent action traces back to the owner.

**How Lathe is delivered.** Lathe is an npm package, built from `lathe/`, installed into each product's own repo, where `lathe.config.json` names the product's specs and diagrams folders and any additions to the meta-model. One Lathe instance reads one product repo. The meta-model ships with Lathe as defaults and travels with the package; a product adds to it without forking. Lathe's own repo keeps Lathe's specification and the Tool Library example, because they are how Lathe is developed. Publishing the package waits until the record format settles, and needs the owner's approval. The Claude Code plugin comes before a CI action, because agents do most of the writing. Lathe also runs as a desktop app (Electron, in `desktop/`): each product folder opens in a window of its own, served by `lathe serve`'s server inside the app, with hot reload while Lathe itself is developed. The owner builds it locally, unsigned; signed builds, auto-update and Windows and Linux builds are still to come, and publishing them needs the owner's approval.

**How Lathe will judge whether it is improving (planned).** Following the foundation, only the person a tool serves can judge its Fitness, so a fitness record holds the owner's own judgment: a date, a score from 1 to 5 and the experiences behind it. Lathe can already hold such records, and its product page would show counts such as coverage, open questions and checks beside the judgment as evidence, never as the score. None has been recorded yet, and how and when the owner judges Lathe is still open (LA-Q01). Lathe never writes a fitness record itself.
