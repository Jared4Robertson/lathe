---
name: plan-tests
description: Write or change Lathe test records and the tests they name - one test kind per thing tested (constraint, invariant, specification, policy, domain service, use case, view, endpoint, flow, integration, pattern rule and standard rule tests), each under what it proves, with its run by (level, state, a file or a manual reason, size and markers), and the test data sets tests start from. Use when planning which tests prove which obligations, writing a test for a Lathe test record, or deciding whether a test is automated, manual or not automated yet, in a repo with lathe.config.json.
---

# Plan tests

Every test proves exactly its parent: a constraint test its constraint, a use case test its UC requirement, and so on. An obligation is **proved** when its tests exist, at a level its kind allows, automated or manual. Write the test plan last, after the record it proves.

Change the spec only with Lathe's MCP tools (or the `lathe` CLI), never by editing files. The test kinds, what each proves, how many each parent takes, the levels each allows, ID patterns and fields are in `lathe/REFERENCE.md` in the Lathe package (`node_modules/@jaredrob/lathe/REFERENCE.md` in a product repo). A test at a level its kind does not allow is a warning.

## Judgment

**One test, one behavior.** A test that seems to prove two records is two tests. Technical records have no tests of their own: each is proved by the tests of what it implements. A standard rule is proved by its standard rule tests (a scan of the code for what it forbids); write only rules the code really follows.

**Lowest level that can observe the result.** Cheapest first: `unit` (in process, no I/O), `integration` (real storage), `service` (through the product's interface in process), `system` (the running product driven from outside), `browser` (a real browser or the desktop shell). Pick the cheapest level that can see what the test expects: a rule on values is unit; one the database enforces is integration; what an endpoint or tool answers is service; what only the running product shows is system; what only a real browser shows (layout, focus, a native menu) is browser. A higher level is slower and flakier and proves nothing more. Climb only when the one below cannot observe the result, and say why in the notes. A flow test is the exception: its use case's acceptance test, the whole main path end to end through one interface that offers it, run at that interface's level. How each other interface carries a step out is its pattern's, proved once per rule and domain by pattern rule tests, never by a flow test per interface.

**Automated, manual or not automated yet.** Write the test with its record when you can. Use "not automated yet" when the code it tests is not written or it needs something not in place, saying in the notes why it waits; it is not proof until automated, and the state and file change together. Use manual only for what code cannot sensibly check (a newcomer's first run of the README's steps), with the reason. Automated needs a file; a manual reason only on a manual test.

**Size and markers.** Leave size out for a small test; volume for many records to show it holds at scale; worst case for the slowest or largest input the product must still handle. Mark smoke only for the few tests run first after a build to show the product works at all, and external only for a test that reaches a system outside the product. Leave a marker out rather than set it false.

**Titles and text.** A test's title is the observable result as a short sentence true when the test passes ("An overdue loan is refused a renewal"), never "Tests that", "Test that" or "Should". `when` is what the test does, with any setup of its own; `then` starts with "Expects" and names what is asserted. There is no Given: shared starting state is a test data set.

**Test data sets.** Describe prepared data (an environment, accounts, starting records, built by a seed or fixture) once under the domain whose tests use it, and name it in each test that starts from it. A set no test starts from is an error; one whose file is missing is reported.

## The test names its ID

An automated test's name starts with its test record's ID so a failing test points at its record and the check can find it. When one test proves several records, name all their IDs at the start of its name. IDs match whole.

Every test case in the product's test files must name a test record whose file is that file, or the check reports it as unnamed. For each one, link it to the record it proves (add the record, and the requirement when the test proves something real the spec does not say), or delete it when it proves nothing. The check reads code as text: a test case is a call of `it` or `test` whose name is a string or template literal, inheriting the names of the `describe` calls around it. A non-literal name and a test made by a helper are not recognized.

## Rules

- Write an automated test record and its test together; never mark a test automated before its file names its ID.
- Aim for every obligation proved; a test not automated yet does not close the gap.
- Finish with `check-and-fix`.
