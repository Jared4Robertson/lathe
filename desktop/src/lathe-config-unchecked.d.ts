// What the build (tsconfig.build.json) sees where the typecheck sees Lathe's config module (lathe/src/config.ts): the
// build may only read files under src/, so it maps 'lathe-config' here, to the few types the shell reads. The shell's use
// of it is checked against the real module by `npm run typecheck`; the build only emits it, and the import is of types
// alone, so it leaves nothing in the output (the module itself is loaded at run time: folders.ts).
export declare const CONFIG_FILE: string;
export declare function readConfig(root: string): { dataDir: string; products: string[] };
export declare function productTitles(dataDir: string): string[];
