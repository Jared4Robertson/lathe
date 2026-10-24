# Lathe

A lathe is a tool that makes tools, including better lathes. Lathe organises a product's lifecycle (domain model, use cases, interaction design, technical specification, test plan) as records that a database checks, traces to the product's code and tests, and a web app lets you browse. Lathe describes itself in its own format.

## What's here

| Folder | What it is |
| --- | --- |
| [lathe/](lathe/) | The tool: the engine, the `lathe` command and the record format ([FORMAT.md](lathe/FORMAT.md)). Packaged as `@jaredrob/lathe`. |
| [app/](app/) | The web app's source: diagrams and spec pages. Built into the package for `lathe serve`. |
| [specs/lathe/](specs/lathe/) | Lathe's own specification (product `LA`). |
| [specs/tool-library/](specs/tool-library/) | The example product's specification (product `TL`). |
| [examples/tool-library/](examples/tool-library/) | The example product's code, whose tests carry their spec IDs. |
| [model/](model/) | CSV brainstorm diagrams (People and tools, SDLC Brainstorm). |
| [NOTES.md](NOTES.md) | The thinking and decisions so far. |
| [notes/briefs/](notes/briefs/) | Reusable briefs for agents working on Lathe. |

## Run it

```bash
npm --prefix lathe install && npm --prefix app install
```

```bash
npm --prefix lathe run check
```

```bash
npm --prefix app run dev
```

The dev server runs at http://localhost:5199. To use Lathe in another product's repo, see the [package README](lathe/README.md).
