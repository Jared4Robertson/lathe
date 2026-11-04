---
name: write-the-technical-spec
description: Write or change a Lathe product's technical specification - the one technical record that implements each design record (data store, repository, data model, table and its keys, value type, predicate, event type and its delivery, projection, reader, command, query and event handlers, service, endpoint handler, adapter, UI component), the files that hold them, and the product's standards. Use when recording where code lives and how it is stored, when adding a table, key or index, when deciding how an event is delivered, or when writing an engineering rule the code follows, in a repo with lathe.config.json.
---

# Write the technical specification

The technical specification says which code implements each design record and how the domain's data is stored. One concrete kind implements each design kind, and each technical record names the file that holds it. Write it after the domain model and the interface design it implements.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. The technical kinds, what each implements, ID patterns and fields are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). Read the design record you implement and the real code first: a record names a real unit in a real file, not a wish.

## Judgment

**Built means the right code exists.** An obligation is built once every specific technical record that implements it names a file that exists, and there is at least one. Records that only support it do not count: a data model, a unique key, a component that only renders the view. A record whose file is not written yet keeps it unbuilt, which is what you want until the code is there.

**One technical record per design record.** What follows from the tree is not stored: a command is carried out by its handler and its aggregate root's data model, so name nothing for that. When one function enforces two invariants, give each invariant its own rule, both titled by that function and naming its file; never split the function for the records' sake. Two rules of one title in two files are refused: they are two functions, each with a name of its own. Every source file is named by a record, directly or through a folder; for each untraced file, name the record it implements, add the missing record when it implements something real, or delete it when it is dead.

**Layers.** The domain layer (data models, value types, predicates, event types, services) never uses a repository or an outside system: a service's inputs are passed in. The application layer (command, query and event handlers) is the only code that reads or writes storage, each through its own aggregate's repository; a command handler owns its transaction, and a projection writes only its own read model's table. Clean architecture's "interactor" is a command handler; a Lathe use case is the actor's goal, one level up.

**One repository per aggregate, and every stored thing names its storage.** Name each place data lives as a data store, under the one domain that uses it. Each repository, reader and table names the data store it is kept in. A table's columns follow from its fields, so it records only its name, storage and keys.

**What to describe.** Where the design leaves a choice open, the record says how the work is done, in a sentence or two: where a repository keeps its aggregate, when a projection is rebuilt, a handler's transaction and the order of its checks, how an adapter calls its outside system. Never restate the design record, and never only list code names. Kinds that transcribe their domain record (data model, value type, predicate, event type, service, table) have no description.

**Tables.** An entity's table holds the source of truth, never a derived view; a read model's is a projection that can be rebuilt (a view over entity tables, a table filled from events, or in memory when nothing keeps it). Keys are asked only of database tables. A unique key backs an invariant but does not build it; the rule's code does.

**Event delivery.** An event a policy hears is delivered by outbox, saved in its aggregate's transaction and delivered afterwards, since a lost reaction is a lost change. An event that only feeds read models rebuilt on every load may go in process.

**Standards.** Rules that hold across the product live in standards, one rule each, and a standard has a type. A quality says what the product's people need whatever it is built with (exact money, auditability, a latency budget): it is essential. Engineering says how the code is built (logging, errors, naming): it is accidental. A technical record that follows a rule says so; that shows where it is applied and proves nothing. Write only rules the code really follows; they are proved by standard rule tests (`plan-tests`).

**Account for every accidental record.** The technical specification is accidental complexity: it must be derived, provided or a fill, never free-floating (`accidental-not-accounted-for` warns of the rest). Derived: a tooling record (the generator) lists the records it `generates`. Provided: name the record's provider, an integration or a product's own record such as a design-system component (`name-provider`); a provided obligation counts as built and proved through it, and whatever sits under a provided record is provided too. A fill: code written by hand at a pattern's slot (`fill-slot`) that serves an essential record: it sits under the essential record it implements, builds an essential obligation, persists an aggregate, is linked to an essential record by one of the product's own relations (either way, such as a handler that runs a CLI command), or holds essential records as its children (such as a component that holds its contracts). Before you write a fill, triage in this order, stopping at the first that applies: can it be deleted? Is it essential in disguise (a rule the domain expert cares about, which belongs in the model)? Is it provided by a platform, library or generator? Does a clear pattern, even a new one, express it? Only then record a fill, naming the slot and the essential obligation it serves. Each fill is listed as accidental debt; three fills of one slot are a pattern candidate, so state what they repeat in the pattern and generate them.

**Packages.** Every package a manifest lists, dev dependencies included, is accounted for by the technical record that uses it. A tool the product is checked or tested with goes on a tooling record.

**Code no kind fits.** Entry points and tooling are Lathe's own kinds. Where nothing fits (a migration, a graph layout, a code generator), declare a kind of the product's own (`extend-the-meta-model`).

## Naming

A technical record is bound to code, so its title is the identifier exactly as the code writes it, with no spaces: `LoanRow`, `buildReference`, `loans`. Explain the unit in its description, never in the title. The exceptions are a UI component (named for what it shows), a standard and its rules, an entry point, tooling and product code-bound kinds. A CLI command is its invocation, a check row the kebab-case name of the mistake.

## Rules

- An endpoint handler's file names its endpoint's method and route, and a UI component's file the route of a view it renders; every route the code serves needs an endpoint or a view.
- When a file moves, change the record's file in the same change.
- A technical kind has no test kind of its own.
- Finish with `check-and-fix`.
