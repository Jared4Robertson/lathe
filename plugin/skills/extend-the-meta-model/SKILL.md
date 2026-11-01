---
name: extend-the-meta-model
description: Add a product's own kinds to Lathe's schema in any of the six stages (discovery, domain model, use cases, interaction design, technical specification, test plan), with their fields and relations, mark an obligation kind and a relation's role, add a product's own checks, or model a code generator and the code it emits. Use when a product needs a record kind or link Lathe does not have, such as a technical kind for code no Lathe kind fits, when the product is built on a code generator, when a house rule needs a check of its own, or when a write of a product kind or relation is refused, in a repo with lathe.config.json.
---

# Extend the meta-model

Lathe's schema is its meta-model: a table per kind with typed columns, a link table per relation, and the keys that hold them together. A product adds to it, for itself only, by declaring its own kinds and relations as data. Lathe then makes a table for each new kind with the same keys and enforcement as its own.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. Kinds, relations and checks the product declares, and the fields of every declaration, are in the tools' schemas; Lathe's own kinds, and how coverage reads a product's obligation kinds, are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). A record of a declared kind is an extension record.

## When to extend

Extend only when the Owner asks, or a real need keeps recurring. Never extend to make a check error or a refused write go away. Lathe is opinionated: before declaring a kind, read the kinds near it in the reference and make sure none fits (an entry point and tooling are Lathe's own kinds for code that starts the product or configures a tool). The most common honest need is a technical kind for code that implements no design record, such as a report script, a migration or a graph layout.

Lathe's own kinds cannot be given another parent or more required fields by a product: that is a change to Lathe's schema. Ask the Owner.

## Judgment

**Stage.** A product kind sits in one of the six stages (or none) and shows there. Discovery: why the product exists beyond an outcome, such as a persona. Domain model: a concept DDD's kinds leave out, such as a saga. Use cases: something a use case owns. Interaction design: a design record of a channel Lathe has no kind for. Technical specification: code that implements no design record. Test plan: a test kind of the product's own.

**Parent and ID.** Its one parent is a Lathe kind or another product kind; start its ID pattern with the parent's name in angle brackets so IDs number under the parent.

**Essential or accidental.** Every kind declares its complexity: essential (what the problem itself demands, decided once by the product, such as a report its people read), accidental (what comes from the means of building it, such as a kind of code), or as-parent (as the record it sits under, such as a test kind). Never mixed: a kind whose records would be both is two kinds. An accidental kind's records must be generated, provided or fills (`write-the-technical-spec`); an essential kind's must name no technology. Words the product's essential records must not use, such as the name of its framework, go in the product's technology words (`set-technology-words`).

**Obligation or not.** Mark a kind an obligation only when each record is something that must be built and proved; Lathe then counts it in coverage and reports the gaps. A new relation's role says whether its links count as design (the source designs the target), build (the source builds it once its file exists), proof (it proves), or none of these.

**Text.** A kind's text is required or absent: give it a lead field (statement, goal, meaning or description) only when its records need words the title, parent, links and other fields cannot say, and then it is required and the only one. A code-bound kind whose title and file say what it is has none. Give every kind, field and relation a plain description; the app shows it.

**Adding a required field to a kind with records.** Add it optional, fill it on each record, then make it required.

**Naming records.** Code-bound kinds take the identifier or file name exactly as in code, with no spaces; a check row, the kebab-case name of the mistake. Other kinds: a singular noun phrase for a thing, an imperative verb and object for a goal, a sentence true when the rule holds. Sentence case, no trailing period, unique within kind and product.

**Removing a kind.** Remove its records first, then the declaration.

## Modeling a code generator

When a product's code is produced by a generator (from a schema, a service declaration, or the product's own records), keep one rule in view: the records own the essential complexity (why and what); the generator owns the accidental complexity (how it is wired). Hand-written code that is only wiring is a candidate for the generator, not for more records.

Declare the generator's side as kinds of the product's own, in the technical specification:

- **The generator** (one record per generator, with its file and the command that runs it). It implements the design records it reads; link the records it reads to it, so a change to a record shows which generator emits from it.
- **An output contract**: one rule about the shape of the code the generator emits ("every emitted handler returns a result and never throws"). It is an obligation, proved by a contract test that runs the generator and checks the emitted code, not by testing each emitted file. This is the rule the generator's users depend on, so it is written once, at the generator.
- **A runtime package**: the library the emitted code imports. Its contract is likewise an obligation with a test, and the emitted code is only correct against a pinned version of it. Account for it as a package of the technical record that uses it.

Rules for the emitted files themselves:

- Emitted code is not a record. Do not write a technical record per emitted file; the generator and its contracts account for them. Leave generated output out of the `source` globs in `lathe.config.json`, so the untraced-file gaps do not list it.
- The first line of every emitted file says it is generated and by what, so nobody edits it by hand. A check or test regenerates and compares (a drift check), so a stale or hand-edited file fails.
- A declaration the generator reads from the records (a versioned query over them) is the one input; do not keep a second hand-written copy.
- A mistake the generator would only find when it runs ("an archetype that does not exist") is refused when the record is written: declare the generator's input kinds with required fields and relations so the write fails, rather than checking afterward.
- A record the generator needs that is provided by a dependency (a component the product uses but does not own) is a different thing from code the product owns. Mark which is which, so a check can flag hand-written accidental code that a dependency could provide.

## A product's own checks

A house rule the schema cannot express ("every command has an endpoint") is a product check, not a new kind. Name it for the mistake in kebab case (never one of Lathe's names); give it a severity (a warning for work still to do, an error only for a broken workspace), a one-sentence summary, an explanation that ends with how to fix what it reports, the kinds it concerns, and one query over the typed tables returning a row for each problem, written as Lathe's own checks are. Run the check after adding one and fix what it finds.

## Rules

- Finish with `check-and-fix`, and report the new coverage lines for a new obligation kind.
