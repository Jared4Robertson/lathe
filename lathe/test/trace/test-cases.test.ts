// Reading a test file's test cases as text (LA-TRC-DS05, test-case-unnamed): which calls are test cases, the names
// they inherit from their describes, and the IDs they name.
import { describe, expect, it } from 'vitest';
import { readTestCases } from '../../src/trace/test-cases.ts';

const read = (lines: string[]) => readTestCases(lines.join('\n')).map((c) => [c.line, c.name, c.ids]);

describe('LA-TRC-DS05-T01 test case reading', () => {
  it('reads it and test calls with their modifiers and each forms, under the names of the describes around them', () => {
    expect(read([
      "describe('TL-LEND-UC01-R01-T01 borrowing', () => {",
      "  it('refuses a tool on loan', () => {});",
      "  describe.skip('when overdue', () => { test.only('refuses', () => {}); });",
      '});',
      "it.each(['TL-LEND-INV01-T', 'TL-LEND-INV02-T'])('%s holds', () => {});",
      'test.each`a | b`("a table", () => {});',
      "it.skipIf(process.env.CI)('skipped on CI', () => {});",
      'it.todo(`one to write`);',
      "test.describe.serial('the catalog', () => { test('TL-V01-R01-T01 lists free tools', async () => {}); });",
    ])).toEqual([
      [2, 'TL-LEND-UC01-R01-T01 borrowing > refuses a tool on loan', ['TL-LEND-UC01-R01-T01']],
      [3, 'TL-LEND-UC01-R01-T01 borrowing > when overdue > refuses', ['TL-LEND-UC01-R01-T01']],
      [5, '%s holds', ['TL-LEND-INV01-T', 'TL-LEND-INV02-T']],
      [6, 'a table', []],
      [7, 'skipped on CI', []],
      [8, 'one to write', []],
      [9, 'the catalog > TL-V01-R01-T01 lists free tools', ['TL-V01-R01-T01']],
    ]);
  });

  it('skips strings, template literals, comments and regular expressions, and calls that are not test cases', () => {
    expect(read([
      "const fixture = \"it('inside a string', () => {})\";",
      'const text = `',
      "  test('inside a template literal ${'x'}')",
      '`;',
      "// it('in a line comment')",
      "/* describe('in a block comment', () => { it('x') }) */",
      "const re = /it\\('in a regular expression'\\)/;",
      "test.beforeEach(async () => {}); test.use({}); test.step('a step', async () => {});",
      'it(name, () => {}); submit(\'a call ending in it\');',
      "obj.it('a method named it');",
      "it('TL-X-T01 the one test case')",
    ])).toEqual([[11, 'TL-X-T01 the one test case', ['TL-X-T01']]]);
  });

  it("names IDs only whole, and unescapes a name's quotes", () => {
    expect(read([
      "it('TL-LEND-INV01-T2 and TL-LEND-INV01-T: in TL-X-Tnot', () => {});",
      "it('a tool\\'s due date', () => {});",
    ])).toEqual([
      [1, 'TL-LEND-INV01-T2 and TL-LEND-INV01-T: in TL-X-Tnot', ['TL-LEND-INV01-T2', 'TL-LEND-INV01-T']],
      [2, "a tool's due date", []],
    ]);
  });
});
