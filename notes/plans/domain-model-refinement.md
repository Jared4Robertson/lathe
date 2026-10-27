# Plan: a DDD and CQRS model with one parent per record

## Outcome
Lathe models every product with one concrete, opinionated model drawn from domain-driven design, CQRS and event storming:
- **The domain model:** aggregates, entities, value objects, rules, events, commands, read models, queries and policies.
- **Use cases on top:** each use case is an actor's goal, and its flow steps invoke commands and queries.
- **Interaction design:** views, endpoints and integrations reached through those steps.
- **Technical kinds:** one concrete kind implements each design kind.
- **Test kinds:** one test kind per thing tested.

Every record has exactly one parent. Other relationships are links, and what can be worked out from the tree is never stored twice.

## Status
Agreed (2026-10-27).

## Context
The database-first build made each kind a typed table, but the kinds themselves stayed as the Markdown era had them:
- **Domain rules mix four different things:** value formats, single-aggregate invariants, cross-aggregate checks and reactions.
- **A use case "changes" nothing explicitly.** Nothing links a use case to the aggregate it changes or the events it causes.
- **Flows are shared.** They sit under a capability and carry out several use cases; 12 of LA's 31 flows cover 2 to 13 use cases each.
- **Use case steps overlap flow steps.**
- **A component is just a file.** LA has 285 of them, with 30 free-text types, under technology layers. Only 23 are used by any flow step.
- **A test is generic.** 391 of LA's 715 tests prove a requirement and a rule together, through a many-to-many `proves` link.
- **Records have several owners.** For example, a test sits under a capability and proves requirements elsewhere, and an interaction requirement may sit under any of six kinds.

The Owner worked through the model as a diagram and settled each point below. S2's test strategy, which splits tests by the level a requirement is stated at, informed the test kinds. Its domain rules were sorted by what they do, to check that the new rule kinds cover all of them.

## Decisions (Owner)

### Domain model
1. **Aggregates are the consistency boundary.** A command changes exactly one aggregate. Changes to other aggregates follow through events (eventual consistency). Commands belong to their aggregate.
2. **Entities have value objects, many-to-many.** A value object has no other owner and exists because entities use it. Event fields may also use value objects.
3. **Rules split by what they do:**
   - **Constraint:** a value object's own rule, checked when the value is created. It belongs to the value object.
   - **Invariant:** holds for one aggregate on every change. It belongs to the aggregate. Uniqueness across records ("no two members share an email") is an invariant, enforced by a unique key.
   - **Specification:** a named predicate over one or more aggregates of one domain (Evans). Commands check it before acting, and queries may select by it. It has no owner: it hangs off the aggregates it reads, and its domain follows from them.
   - **Policy:** "whenever event X, then command Y" (event storming). It belongs to the command it invokes, and it hears one event.
4. **Commands and queries (CQRS):**
   - A command raises events and checks specifications.
   - A query belongs to the one read model it reads, and changes nothing.
   - A read model belongs to its domain and reads that domain's aggregates. It may span several aggregates.
5. **Domains meet only through published events.** A domain event may be marked published, which makes its shape a promise to other domains. A policy may hear its own domain's events, or another domain's published ones. Commands, queries, read models and specifications stay inside their own domain.
6. **"Domain" keeps its name.** It is what DDD calls a bounded context: a model, a language and an owner, for one business capability.

### Use cases
7. **A use case is an actor's goal:** its actors, its UC requirements and its one flow. It changes nothing itself; its flow steps invoke commands and queries.
8. **A use case has exactly one flow, and the flow belongs only to it.** Alternate courses are paths within the flow. Use case steps go.
9. **Flow steps fulfill UC requirements.** A step may fulfill only requirements of its own use case. Every UC requirement must be fulfilled by at least one step of its flow.

### Interaction design
10. **A flow step invokes at most one command or query,** happens in at most one view, and may exchange with integrations.
11. **An endpoint exposes exactly one command or query.** Steps reach endpoints through their command or query, never directly.
12. **Views and integrations have no owner.** Each exists because flow steps use it. The API grouping of endpoints goes.
13. **Interaction requirements split into view requirements and API requirements,** under their view and endpoint.

### Technical specification
14. **One concrete kind implements each design kind,** in place of the generic component, its free-text type and layers:

    | Technical kind | Implements |
    | --- | --- |
    | Repository | Aggregate: loads and saves it |
    | Data model | Entity: its code, behavior and mapping to storage |
    | Value type | Value object, and so its constraints |
    | Predicate | Specification |
    | Event type | Domain event: its shape, a contract when published |
    | Projection | Read model: builds it and keeps it current |
    | Command handler | Command |
    | Query handler | Query |
    | Event handler | Policy |
    | UI component | Views, many-to-many, with no other owner |
    | Endpoint handler | Endpoint |
    | Adapter | Integration |

    A command is carried out by its handler and its aggregate root's data model. Links that follow from the tree aren't stored, such as a handler loading its repository.
15. **Products declare extra technical kinds** through product kinds. Lathe declares its own where its code fits none of these.

### Test plan
16. **Nine test kinds, each named after what it tests, each with one parent:**

    | Test kind | Belongs to | How many |
    | --- | --- | --- |
    | Constraint test | Constraint | Exactly one |
    | Invariant test | Invariant | Exactly one |
    | Specification test | Specification | Exactly one |
    | Policy test | Policy | Exactly one |
    | Use case test | UC requirement | At least one |
    | View test | View requirement | At least one |
    | Endpoint test | API requirement | At least one |
    | Flow test | Flow | Exactly one: a smoke test of the main path |
    | Integration test | Integration | Any |

    The `proves` link goes, and a test proves exactly its parent.
17. **Technical kinds have no test kinds of their own.** Each is proved by the tests of what it implements.
18. **Every test has a run by:** a level, a state and a file or manual reason.
    - **Levels:** unit, database, api, contract, e2e-api, e2e-ui and manual. The integration level is renamed database, so it doesn't clash with integration tests.
    - **States:** automated, manual and not automated yet.

### Stages and order
19. **Kinds are colored and ordered by stage:** domain model, use cases, interaction design, technical specification and test plan. Product and role sit outside the stages. In every diagram, links run from what is defined first to what is defined later.

## Scope

### The kinds
Forty-five kinds. **Parent** is the one foreign key that places a record. **Links** are relations to other records.

| Stage | Kind | Parent | Links | ID |
| --- | --- | --- | --- | --- |
| — | Product | — | | `<P>` |
| — | Role | Product | | Its name, within the product, as today |
| Domain model | Domain | Product | | `<P>-<D>` |
| | Aggregate | Domain | | `<P>-<D>-A<n>` |
| | Entity | Aggregate | has value objects | `<P>-<D>-EN<nn>` |
| | Value object | — (used by 1+ entities) | | `<P>-VO<nn>` |
| | Constraint | Value object | | `<value object>-C<nn>` |
| | Invariant | Aggregate | | `<P>-<D>-INV<nn>` |
| | Specification | — (reads 1+ aggregates, all of one domain) | | `<P>-<D>-SP<nn>` |
| | Domain event | Aggregate | raised by 1+ commands; published flag | `<P>-<D>-EV<nn>` |
| | Command | Aggregate | raises events; checks specifications | `<P>-<D>-CMD<nn>` |
| | Read model | Domain | reads 1+ aggregates | `<P>-<D>-RM<nn>` |
| | Query | Read model | selects by specifications | `<P>-<D>-QRY<nn>` |
| | Policy | Command | hears one event | `<P>-<D>-PO<nn>` |
| Use cases | Capability | Domain | | `<P>-<D>-CAP<nn>` |
| | Use case | Capability | actors (roles) | `<P>-<D>-UC<nn>` |
| | UC requirement | Use case | | `<use case>-R<nn>` |
| Interaction design | Flow | Use case (one) | | `<use case>-FL` |
| | Flow step | Flow | fulfills UC requirements; invokes a command or query; happens in a view; exchanges with integrations | `<flow>-S<nn>` |
| | View | — (used by 1+ steps) | | `<P>-V<nn>` |
| | View requirement | View | | `<view>-R<nn>` |
| | Endpoint | Its command or query | | `<P>-<D>-EP<nn>` |
| | API requirement | Endpoint | | `<endpoint>-R<nn>` |
| | Integration | — (used by 1+ steps) | | `<P>-INT<nn>` |
| Technical | Repository, data model, value type, predicate, event type, projection, command handler, query handler, event handler, endpoint handler, adapter | What it implements (one) | | `<parent>-` plus REPO, DM, VT, PR, ET, PJ, H or AD |
| | UI component | — (used by 1+ views) | | `<P>-UI<nn>` |
| Test plan | Constraint, invariant, specification, policy and flow tests | Their parent (one) | | `<parent>-T` |
| | Use case, view, endpoint and integration tests | Their parent | | `<parent>-T<nn>` |

The domain-model IDs are scoped to the domain, which follows from the parent. Kinds with no owner take product-scoped IDs.

### Kept as they are
- Patterns and their rules and settings.
- Standards and their rules.
- Entity fields and event fields. A field's type becomes a value object or a basic type from a fixed list: text, whole number, decimal, date, time and yes/no. Free-text types go.
- Product kinds, checks, the command layer, the merge driver and JSONL storage.
- Open questions. A question sits under its product or domain, with an optional `about` link to any record.

### How rules are enforced
- **The schema refuses broken data:**
  - a missing or wrong-kind parent;
  - a link to a kind its relation doesn't allow;
  - a link across products;
  - a step fulfilling another use case's requirement;
  - a policy hearing another domain's unpublished event;
  - a command and a specification, or a query and its read model, in different domains;
  - more than the allowed number, where the limit is "exactly one" or "at most one".
- **Checks report what is missing,** because records are written stage by stage:
  - **Errors:** a view, integration, value object, specification or UI component that nothing uses.
  - **Coverage gaps, reported as designed, built and proved:** for example, a capability with no use case, a use case with no flow, a UC requirement no step fulfills, or an obligation with no test.
- **Obligations:** constraint, invariant, specification, policy, UC requirement, view requirement, API requirement, pattern rule and standard rule.
  - **Designed:** the obligation's implementation is specified. A UC requirement is designed once a flow step fulfills it.
  - **Built:** the implementing technical record names a file that exists.
  - **Proved:** its test exists, with a run by at a level its kind allows.

### Out of scope
Domain services, a glossary, context-map relationships and engineering checks. Each can be added later as a kind when a product needs it.

## Changes to existing specs
- **The vertical slices plan** ([vertical-slice-domains.md](vertical-slice-domains.md)): decision 1's "technology is a layer inside a domain's design stage" is replaced. Domains stay vertical slices, but technology is expressed through the technical kinds that implement each design kind, and layers go.
- **Authoring, Lathe's own spec of its model:** the meta-model, the record kinds and their rules are rewritten for the forty-five kinds, the new relations and the enforcement above.
- **Checking:** check records are rewritten. Retired checks become schema refusals, and the new "nothing uses it" and coverage checks are added.
- **Traceability:** coverage is reworked to cover the new obligations, designed through flow steps and implementations, built through technical files, and proved through test kinds.
- **Exploring:** stage colors and order, kind pages for the new kinds, and the graph and Model views drawing the new tree.
- **Plugin:** the modeling skill teaches the event storming order: aggregates, commands and events, then rules, read models and queries, then use cases and flows, then implementations and tests.
- **The reference** (`REFERENCE.md`) is regenerated from the schema.

## Build steps
1. **Schema.** Rewrite the stage files in `lathe/schema/` for the forty-five kinds, their relations, ID patterns, stage order and the refusals above. This is a hard cutover with no upgrade migrations, since the database is rebuilt from the data files on every load. The store supports kinds with no owner and parents that may be one of two kinds (an endpoint under a command or a query).
2. **Conversion of the Tool Library, as the worked example.**
   - A one-time converter in the store makes the mechanical moves, then is deleted.
   - Judgment moves are made by hand through the command layer: sorting rules into the four kinds, splitting use cases into commands, queries and flow steps, mapping components to technical kinds, and splitting tests by what they prove.
   - The Owner reviews the converted Tool Library before LA is converted.
3. **In parallel, once step 1 is merged:**
   - **Conversion of LA,** one agent per domain, following the Tool Library pattern.
   - **Engine:** checks, coverage views and the generated reference.
   - **Writers:** the CLI and MCP tools pick up the kinds from the schema, and the modeling skill is rewritten.
   - **App:** kind pages, forms, stage colors, and the graph and Model views on the new tree.
4. **Lathe's own spec** (Authoring, Checking, Traceability, Exploring) is updated to describe the new model, once LA's data is converted.
5. **Integration:** merge the branches into one integration branch and run the full checks once: lathe, app and desktop typecheck, tests and knip; `lathe check` with no errors on both products; and the stability, a11y and perf suites. Fix by area, then merge into main with the Owner's approval.

## Open questions
1. **What proves a pattern rule or a standard rule?** Today, 72 of LA's tests prove pattern rules.
   - Recommendation: a **pattern rule test** under the pattern rule, naming the adopting domain it proves the rule in. Standard rules are proved by the engine's checks or linters, named in a run by.
   - Owner: Owner.
2. **Which technical kinds does Lathe declare for itself?** Candidates include check, CLI command, schema migration and graph layout.
   - Recommendation: declare them while converting LA, only where none of the twelve technical kinds fits, and list them for review with the LA conversion.
   - Owner: Owner.
