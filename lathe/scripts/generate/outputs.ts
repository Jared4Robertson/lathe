// Every output of `npm run generate`, in the order it writes them.
import { identityFiles, identityScaffolds } from './identities.ts';
import type { Generated, Output } from './output.ts';

export const OUTPUTS: readonly Output[] = [
  { name: 'command and query identities', files: identityFiles, scaffolds: identityScaffolds },
];

/** Every generated file of every output. */
export function generatedFiles(repo: string): Generated {
  return new Map(OUTPUTS.flatMap((o) => [...o.files(repo)]));
}

/** Every scaffold of every output: the files to start, or to add a definition to. */
export function scaffoldFiles(repo: string): Generated {
  return new Map(OUTPUTS.flatMap((o) => [...(o.scaffolds?.(repo) ?? [])]));
}
