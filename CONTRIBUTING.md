# Contributing to Lathe

Thank you for helping. This page says how a change gets from your branch onto `main`. By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE), the project's license, and you certify the Developer Certificate of Origin for each commit.

## Before you start

- **Open an issue first** for anything larger than a small fix, so the change can be agreed before you build it.
- **Read the spec.** Lathe describes itself in its own format: its specification is the data in [data/](data/), and [lathe/REFERENCE.md](lathe/REFERENCE.md) explains every kind of record. A change to behavior usually changes the records that describe it in the same branch.
- **Set up your clone** with Node 26 (see [.nvmrc](.nvmrc)), then once per clone:

  ```sh
  npm ci --prefix lathe && npm ci --prefix app && npm ci --prefix desktop && npm ci --prefix examples/tool-library
  git config core.hooksPath .githooks
  git config merge.lathe-data.name "Lathe data files"
  git config merge.lathe-data.driver "node lathe/bin/lathe.ts merge-data %O %A %B %P"
  ```

  The hook checks a squash commit's title on `main`; the merge driver merges the data files row by row (see the [package README](lathe/README.md#the-merge-driver)).

## One branch per change

Make each change on its own branch from `main`, and open one pull request for it. Keep a branch to one change: a fix and an unrelated cleanup are two branches.

## Sign off every commit (DCO)

Every commit must carry a `Signed-off-by:` line with your name and email, matching the commit's author. It certifies the [Developer Certificate of Origin](https://developercertificate.org): that you wrote the change, or otherwise have the right to submit it under the project's license. Git adds the line for you:

```sh
git commit -s -m "Explain what changed"
```

To sign off commits you already made on your branch, run `git rebase --signoff main`. The [dco workflow](.github/workflows/dco.yml) checks every commit of a pull request with [scripts/check-dco.sh](scripts/check-dco.sh), which you can run yourself: `scripts/check-dco.sh main HEAD`.

## Change the spec only through its commands

Spec records live in `data/*.jsonl`, one file per table. Never edit those files by hand: change them with the `lathe` CLI (`npm --prefix lathe run lathe -- <aggregate> <command> --root .. ...`; `lathe help` lists them), the Claude Code plugin's MCP tools, or the web app. Each command checks its aggregate's rules and refuses a write that breaks the model. Then run `npm --prefix lathe run check`: it must report 0 errors.

Specs name roles (Owner, Reader, Agent), never people. Nothing in the repository may name a product Lathe was tried on, a person, or one machine's own folders; a test (`lathe/test/public-tree.test.ts`) refuses them.

## Run the checks

[scripts/ci.sh](scripts/ci.sh) runs the merge gate, the same one the [ci workflow](.github/workflows/ci.yml) runs on every pull request: types, knip, every package's unit tests and `lathe check`. It exits non-zero if any step failed and writes a summary to `ci-result.md`.

```sh
scripts/ci.sh --title "fix(graph): a node keeps its place when its title changes"
```

The browser suites (`scripts/ci.sh --browser`: stability, accessibility and phone layout) run on `main` after a merge, not on pull requests. If your change touches the web app, add or update the scenarios they need.

## The pull request title is the squash commit

Each pull request lands on `main` as **one squash commit**, titled with the pull request's title, so the title must carry a [Conventional Commits](https://www.conventionalcommits.org) type:

```
type(scope)!: summary
```

- **type:** `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`, or `spec` for a change to the spec's records alone (`data/*.jsonl`).
- **scope** (optional): the domain or area in lowercase, such as `journeys`, `graph` or `server`.
- **`!`** marks a breaking change.

Commits on your branch can be titled freely. The [pr-title workflow](.github/workflows/pr-title.yml) checks the title, and `scripts/ci.sh --title "<title>"` checks it locally. Release notes are grouped by these types.

## Style

- Plain, direct English with American spelling (modeling, color, center), in code, specs and docs.
- When you rename or reshape something, change every call site, record and test to the new form in the same change, and remove the old one. Lathe keeps no aliases, redirects or compatibility shims.
- When you remove something, remove what only served it too: code, styles, tests, records and docs.

## Reporting a security problem

Please do not open a public issue. See [SECURITY.md](SECURITY.md).

## Code of conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
