// What is read from a file's text, kept by the text: every checks' run and load reads the repo's files again (its
// test files, the files that serve routes), and most are as they were, so what was read from each is not read again
// (LA-PLT-UC01-R03). The text itself is the key, so a changed file is read afresh; nothing read is ever changed.

/** The most texts one reading keeps; past it, it starts again (more than a repo has files of one sort). */
const KEPT_TEXTS = 5000;

/** The reading, kept by the text it read: the same text gives the same answer, read once. */
export function keptByText<T>(read: (text: string) => T): (text: string) => T {
  const kept = new Map<string, T>();
  return (text) => {
    if (kept.has(text)) return kept.get(text)!;
    if (kept.size >= KEPT_TEXTS) kept.clear();
    const value = read(text);
    kept.set(text, value);
    return value;
  };
}
