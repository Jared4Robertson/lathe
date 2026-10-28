// The test cases in a product's test files, read from the code as text, for test-case-unnamed: each it( or test( call
// with its own name and the names of the describe( calls around it. Reading code as text, not running it, it knows
// only what is written:
// - a test case is a call of it or test (also test as Playwright writes it), with any of the modifiers only, skip,
//   todo, fails, fail, fixme, slow, concurrent, sequential, skipIf(…), runIf(…), each(…) and each`…`, whose first
//   argument is a string or template literal: `it.each(rows)('name', …)`, `test.skip('name', …)`;
// - a describe is a call of describe or test.describe, with the same modifiers and serial or parallel, whose first
//   argument is a literal; the test cases inside its parentheses inherit its name;
// - strings, template literals and comments are skipped, so a test written inside a fixture's text is not one;
// - not recognized: a name that is not a literal (it(name, …)), a test made by a helper function that calls it or
//   describe (its own call, inside the helper, is read with the helper's literal or not at all), and test runners
//   other than these call forms. A template literal's ${…} parts are read as written, not evaluated.
//
// The IDs a test case names are every ID-shaped word, as a whole ID, in its name, in the rows of its each(…) (where
// `it.each(['LA-X-T01', 'LA-X-T02'])('%s …')` writes them) and in the same of the describes around it.

/** A test case in a test file: its line, its name as written, and the IDs it and its describes name. */
export interface TestCase {
  line: number;
  /** The describes' names and the test's own, joined by " > ". */
  name: string;
  ids: string[];
}

const TEST_MODIFIERS = new Set(['only', 'skip', 'todo', 'fails', 'fail', 'fixme', 'slow', 'concurrent', 'sequential', 'skipIf', 'runIf', 'each']);
const DESCRIBE_MODIFIERS = new Set([...TEST_MODIFIERS, 'serial', 'parallel']);

/** A whole ID: capital words and numbers joined by hyphens, not inside a longer one (as mentionsId reads an ID). */
const ID = /(?<![A-Za-z0-9-])[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+(?![A-Za-z0-9]|-[A-Za-z0-9])/g;

/** The IDs a text names, as whole IDs. */
const idsIn = (text: string): string[] => [...text.matchAll(ID)].map((m) => m[0]);

// The code with every comment blanked and every string and template literal's contents blanked (its quotes kept),
// position for position, so calls and parentheses can be found with no string or comment fooling them. Regular
// expression literals are told from division by the token before them.
function blankLiterals(text: string): string {
  const out = text.split('');
  const blank = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  let i = 0;
  // Template literals nest through ${…}: each open template's brace depth when its ${ began.
  const templates: number[] = [];
  let depth = 0;
  let lastToken = '';
  const n = text.length;
  const readString = (quote: string) => {
    const start = i;
    i++;
    while (i < n && text[i] !== quote && text[i] !== '\n') i += text[i] === '\\' ? 2 : 1;
    blank(start + 1, Math.min(i, n));
    i++;
  };
  // Reads template text from i (just after ` or }) to its end or to a ${, blanking the text.
  const readTemplate = () => {
    const start = i;
    while (i < n && text[i] !== '`' && !(text[i] === '$' && text[i + 1] === '{')) i += text[i] === '\\' ? 2 : 1;
    blank(start, Math.min(i, n));
    if (text[i] === '`') { i++; lastToken = 'literal'; return; }
    templates.push(depth);
    depth++;
    i += 2;
    lastToken = '{';
  };
  while (i < n) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      blank(i, end < 0 ? n : end);
      i = end < 0 ? n : end;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      blank(i, end < 0 ? n : end + 2);
      i = end < 0 ? n : end + 2;
    } else if (c === '"' || c === "'") {
      readString(c);
      lastToken = 'literal';
    } else if (c === '`') {
      i++;
      readTemplate();
    } else if (c === '}' && templates.length && templates[templates.length - 1] === depth - 1) {
      templates.pop();
      depth--;
      i++;
      readTemplate();
    } else if (c === '/' && (lastToken === '' || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(lastToken) || /^(return|typeof|case|do|else|in|of|void|yield|await)$/.test(lastToken))) {
      // A regular expression literal: blank it to its closing slash, minding escapes and character classes.
      const start = i;
      i++;
      let inClass = false;
      while (i < n && text[i] !== '\n' && (inClass || text[i] !== '/')) {
        if (text[i] === '\\') i++;
        else if (text[i] === '[') inClass = true;
        else if (text[i] === ']') inClass = false;
        i++;
      }
      blank(start + 1, Math.min(i, n));
      i++;
      while (i < n && /[a-z]/.test(text[i])) i++;
      lastToken = 'literal';
    } else if (/\s/.test(c)) {
      i++;
    } else if (/[A-Za-z0-9_$]/.test(c)) {
      const start = i;
      while (i < n && /[A-Za-z0-9_$]/.test(text[i])) i++;
      lastToken = text.slice(start, i);
    } else {
      if (c === '{') depth++;
      else if (c === '}') depth--;
      lastToken = c;
      i++;
    }
  }
  return out.join('');
}

// The index just past the parenthesis or bracket that closes the one at `open`, in blanked code; -1 when none does.
function closing(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

const skipSpace = (code: string, at: number) => {
  while (at < code.length && /\s/.test(code[at])) at++;
  return at;
};

/** The test cases in a test file's text, in order. */
export function readTestCases(text: string): TestCase[] {
  const code = blankLiterals(text);
  const calls: { kind: 'describe' | 'test'; at: number; end: number; name: string; rows: string }[] = [];
  const start = /(?<![A-Za-z0-9_$.])(describe|it|test)\b/g;
  for (let match = start.exec(code); match; match = start.exec(code)) {
    let kind: 'describe' | 'test' = match[1] === 'describe' ? 'describe' : 'test';
    let at = match.index + match[1].length;
    let modifiers = true;
    let rows = '';
    // The modifiers: .only, .skip, .describe (after test), .each(…), .each`…`, .skipIf(…).
    for (;;) {
      const dot = skipSpace(code, at);
      if (code[dot] !== '.') break;
      const word = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(code.slice(skipSpace(code, dot + 1)));
      if (!word) { modifiers = false; break; }
      const name = word[0];
      if (name === 'describe' && match[1] === 'test' && kind === 'test') kind = 'describe';
      else if (!(kind === 'describe' ? DESCRIBE_MODIFIERS : TEST_MODIFIERS).has(name)) { modifiers = false; break; }
      at = skipSpace(code, dot + 1) + name.length;
      if (name === 'each' || name === 'skipIf' || name === 'runIf') {
        const next = skipSpace(code, at);
        if (code[next] === '(') {
          const end = closing(code, next);
          if (end < 0) { modifiers = false; break; }
          if (name === 'each') rows += text.slice(next, end);
          at = end;
        } else if (code[next] === '`') {
          const end = code.indexOf('`', next + 1);
          if (end < 0) { modifiers = false; break; }
          if (name === 'each') rows += text.slice(next, end + 1);
          at = end + 1;
        } else { modifiers = false; break; }
      }
    }
    if (!modifiers) continue;
    const open = skipSpace(code, at);
    if (code[open] !== '(') continue;
    const quote = skipSpace(code, open + 1);
    if (!['"', "'", '`'].includes(code[quote])) continue;
    const nameEnd = code.indexOf(code[quote], quote + 1);
    const end = closing(code, open);
    if (nameEnd < 0) continue;
    calls.push({ kind, at: match.index, end: end < 0 ? code.length : end, name: text.slice(quote + 1, nameEnd).replace(/\\(.)/g, '$1'), rows });
  }
  const breaks = [...text.matchAll(/\n/g)].map((m) => m.index);
  const lineAt = (at: number) => {
    let low = 0;
    let high = breaks.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (breaks[mid] < at) low = mid + 1;
      else high = mid;
    }
    return low + 1;
  };
  return calls
    .filter((c) => c.kind === 'test')
    .map((c) => {
      const around = [...calls.filter((d) => d.kind === 'describe' && d.at < c.at && c.at < d.end), c];
      return { line: lineAt(c.at), name: around.map((d) => d.name).join(' > '), ids: [...new Set(around.flatMap((d) => [...idsIn(d.name), ...idsIn(d.rows)]))] };
    });
}
