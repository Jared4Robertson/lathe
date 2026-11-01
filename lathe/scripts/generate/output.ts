// What `npm run generate` writes: each output's files from Lathe's records (and code), whole, and the scaffolds it
// creates once for what is not written yet. An output is added to OUTPUTS (generate/outputs.ts) and its files are
// then written by the script and held to a fresh generation by the freshness test.

/** The first line of every generated file. */
export const GENERATED_HEADER = '// Generated from data/ by `npm run generate`. Do not edit.';

/** Files by path from the repo root, with their whole text. */
export type Generated = Map<string, string>;

/** One kind of generated file. */
export interface Output {
  name: string;
  /** The files it generates, whole: written every time, and equal to a fresh generation in the freshness test. */
  files: (repo: string) => Generated;
  /** The hand-written files it starts, for what is not written yet: written once, then filled by hand. */
  scaffolds?: (repo: string) => Generated;
}

/** The folders generated files are written under, from the repo root: a generated file there that no output makes is removed. */
export const GENERATED_ROOTS: readonly string[] = ['lathe/src', 'app/src'];
