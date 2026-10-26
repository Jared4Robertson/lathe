---
id: LA-CHK-DF01
kind: design_flow
title: Load and check a workspace
parent: LA-CHK-LAY02
links:
  deepens: [LA-CHK-F01]
---
How `lathe check` carries out the agent's check after an edit: it loads the product's records into an in-memory DuckDB database, runs every check over it, counts coverage, and reports. Nothing is written to disk, so there is no transaction to commit and nothing to lock.

## Failure

| What fails | What happens |
| --- | --- |
| A record file cannot be parsed. | It becomes a `parse-error` problem naming the file, and loading carries on with the others. |
| A check's SQL fails. | It becomes an error naming the check's file, and the other checks still run. |
| The config names a checks folder that does not exist. | It is a `product-checks-missing` error. |

## Signals

| Signal | Meaning |
| --- | --- |
| Exit status 1 | At least one error. |
| Exit status 0 | No errors; warnings do not change it. |
