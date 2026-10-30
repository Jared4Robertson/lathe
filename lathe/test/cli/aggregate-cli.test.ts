// The aggregates' commands on the command line (`lathe <aggregate> <command>`): fields as JSON from stdin or a file, in
// the command's MCP tool's shape, written exactly as given; and a refusal that prints every reason and changes nothing.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runAggregateCommand } from '../../src/cli/aggregates.ts';
import { callTool } from '../../src/cli/mcp.ts';
import { everyKind, removeData, writeData } from '../store/fixture.ts';

afterAll(removeData);

/** Runs `lathe <args> --root <root>` in process, with the given stdin; returns the exit code and what it printed. */
async function lathe(root: string, args: string[], stdin = '') {
  const out: string[] = [];
  const err: string[] = [];
  const status = await runAggregateCommand([...args, '--root', root], { out: (t) => out.push(t), err: (t) => err.push(t), stdin: async () => stdin });
  return { status, out: out.join('\n'), err: err.join('\n') };
}

const files = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).sort().map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));

describe('fields as JSON', () => {
  it('LA-PLT-UC18-R03-T01 text with quotes, newlines and backticks given as JSON is written exactly, from stdin or a file, in the tool\'s shape', async () => {
    const root = writeData(everyKind());
    const text = 'The library MUST say "no" when it\'s lent:\n\t`lent` tools — and naïve ones — are refused.';
    // From stdin: the same object the MCP tool takes, and the result as JSON.
    const requirement = { id: 'TL-LEND-UC01-R02', title: 'Lent tools are refused', use_case_id: 'TL-LEND-UC01', statement: text };
    const added = await lathe(root, ['use-case', 'add-uc-requirement', '--json', '-'], JSON.stringify(requirement));
    expect(added.status).toBe(0);
    expect(JSON.parse(added.out)).toMatchObject({ tables: ['uc_requirement'] });
    expect(readFileSync(path.join(root, 'data', 'uc_requirement.jsonl'), 'utf8')).toContain(JSON.stringify(text));
    // From a file.
    const goal = path.join(root, 'goal.json');
    writeFileSync(goal, JSON.stringify({ id: 'TL-LEND-UC01', goal: text }));
    expect((await lathe(root, ['use-case', 'change-use-case', '--json', goal])).status).toBe(0);
    expect(readFileSync(path.join(root, 'data', 'use_case.jsonl'), 'utf8')).toContain(`"goal":${JSON.stringify(text)}`);
    // A list as JSON, and the same command's tool, read by one reader to one result.
    expect((await lathe(root, ['use-case', 'change-flow-step', '--json', '-'], JSON.stringify({ id: 'TL-LEND-UC01-FL01-S01', fulfills: ['TL-LEND-UC01-R01', 'TL-LEND-UC01-R02'] }))).status).toBe(0);
    const tool = await callTool(root, 'use_case_change_flow_step', { id: 'TL-LEND-UC01-FL01-S01', fulfills: ['TL-LEND-UC01-R01'] });
    expect(tool.isError).toBeUndefined();
    expect(readFileSync(path.join(root, 'data', 'fulfills.jsonl'), 'utf8')).toBe('{"source_id":"TL-LEND-UC01-FL01-S01","target_id":"TL-LEND-UC01-R01"}\n');
    // The same validation as the flags: a parent that does not exist is refused either way.
    const lost = { id: 'TL-LEND-UC09-R01', title: 'Lost', use_case_id: 'TL-LEND-UC09', statement: 'The library MUST find it.' };
    const piped = await lathe(root, ['use-case', 'add-uc-requirement', '--json', '-'], JSON.stringify(lost));
    expect(piped.status).toBe(1);
    expect(JSON.parse(piped.out)).toMatchObject({ refused: true, problems: [expect.objectContaining({ rule: 'missing' })] });
    const flagged = await lathe(root, ['use-case', 'add-uc-requirement', ...Object.entries(lost).flatMap(([k, v]) => [`--${k}`, v])]);
    expect(flagged.status).toBe(1);
    expect(flagged.err).toMatch(/^Refused; nothing changed:\n.*\[missing\]/);
    // JSON given with field flags is bad usage; JSON that is not an object is refused before anything is read.
    expect((await lathe(root, ['use-case', 'add-uc-requirement', '--json', '-', '--title', 'x'], '{}')).status).toBe(2);
    expect((await lathe(root, ['use-case', 'add-uc-requirement', '--json', '-'], '[1]')).status).toBe(1);
  });
});

describe('a refusal', () => {
  it('LA-PAT-AGGREGATE-COMMANDS-R02-T01 a command the aggregate refuses prints every reason with its rule, exits 1, and changes nothing', async () => {
    const root = writeData(everyKind());
    const before = files(root);
    const refusals = [
      // An aggregate under a domain that does not exist, and one whose ID is outside its domain.
      ['aggregate', 'add-aggregate', '--id', 'TL-SHOP-A1', '--title', 'Sale', '--domain_id', 'TL-SHOP', '--identity', 'Sale ID', '--description', 'One sale.'],
      ['aggregate', 'add-aggregate', '--id', 'TL-CAT-A9', '--title', 'Shelf', '--domain_id', 'TL-LEND', '--identity', 'Shelf ID', '--description', 'A shelf.'],
      // A link its relation does not allow, and a record still referenced.
      ['use-case', 'change-flow-step', '--id', 'TL-LEND-UC01-FL01-S01', '--invokes', 'TL-LEND-EV01'],
      ['value-object', 'remove-value-object', '--id', 'TL-VO01'],
    ];
    for (const args of refusals) {
      const refused = await lathe(root, args);
      expect(refused.status, args.join(' ')).toBe(1);
      expect(refused.err, args.join(' ')).toMatch(/^Refused; nothing changed:\n( {2}.* \[[a-z-]+\]\n?)+$/);
    }
    // The tool returns the same refusal, with its reasons, as data.
    const tool = await callTool(root, 'aggregate_add_aggregate', { id: 'TL-SHOP-A1', title: 'Sale', domain_id: 'TL-SHOP', identity: 'Sale ID', description: 'One sale.' });
    expect(tool).toMatchObject({ isError: true, structuredContent: { refused: true, problems: [expect.objectContaining({ rule: expect.any(String) })] } });
    expect(files(root)).toEqual(before);
  });
});
