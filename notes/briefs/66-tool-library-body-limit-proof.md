# Brief: prove the Tool Library's body size limit

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
`TL-LEND-E06-R03` ("A request body over 64 KB MUST be refused with 413 `body_too_large` before it is parsed") is the one long-standing warning in `lathe check`: its test `TL-LEND-T30` is only planned. Make it proved.

## What to do
1. In `examples/tool-library/`, check whether the router or server already enforces the limit (`src/router.ts`, `src/server.ts`). If not, build it the way the spec says: refuse before parsing, for every endpoint's body, with 413 and the error code `body_too_large`, without reading the rest of the stream. Endless bodies count.
2. Write the automated test in `test/api.test.ts`, or a new file, under T30's ID:
   - a body just under the limit is accepted;
   - a body just over it gets 413 `body_too_large`;
   - a streamed body that never ends is refused without the server waiting for it.
3. Update `T30`: `state: automated` (or remove `state`), `run_by` set to the file, and its body text. Make sure the component that satisfies `TL-LEND-E06-R03` names the code that enforces the limit.
4. `npm --prefix lathe run check` no longer shows the `unproved TL-LEND-E06-R03` warning.

## Scope
You own `examples/tool-library/**` and the TL records named above. Specs name roles, never people. Run the example's tests (`npm --prefix examples/tool-library test`) and the full checks.

## Report
Use the format in 00-common-rules, with your branch and its last commit.
