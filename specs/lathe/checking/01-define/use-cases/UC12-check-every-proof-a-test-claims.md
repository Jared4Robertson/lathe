---
id: LA-CHK-UC12
kind: use_case
title: "Check every proof a test claims"
parent: LA-CHK-CAP01
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR60, LA-CHK-DR61, LA-CHK-DR62, LA-CHK-DR63, LA-CHK-DR30]
---
A test record says which records it proves. A person, or an AI agent, writes the test and its code, and `lathe check` confirms that the code backs every claim:

1. If the test's file names the test's own ID, the test record vouches for all its claims.
2. Otherwise the file must name every ID the test proves. For a test that proves two rules but whose code names only one, the check reports the one left out.
3. A test whose code names no ID at all, such as a pattern proof kept in its own file, gives a `key`: text the file must contain, such as a test function name.

The person fixes each error by naming the missing ID in the test's name, by naming the test's own ID, or by removing a claim the test does not really prove.
