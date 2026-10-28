// Packages: every package a product's package.json files list is accounted for by a technical record that names it
// (a package_use row), and every package a record names is one of them.
//
// It reads each manifest as JSON and takes the names under dependencies, devDependencies, optionalDependencies and
// peerDependencies: a dev dependency is tooling the product runs (a test runner, a type checker, a bundler), so it is
// accounted for as a runtime one is. It does not read lock files, workspaces, or manifests of other ecosystems, and it
// does not judge whether code imports a package; knip finds a dependency no code uses.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE } from '../config.ts';

const MANIFEST = 'package.json';

/** The sections of a package.json whose names are the product's packages. */
const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;

/** One package a manifest lists, as the checks and coverage read it (package_facts). */
export interface PackageFact {
  /** The manifest, from the root, such as app/package.json. */
  manifest: string;
  package: string;
}

/**
 * The package folders, from the root: those the config lists, or else the root and each folder directly under it
 * (not hidden, not node_modules) that holds a package.json.
 */
function manifestFolders(root: string, listed: string[] | null): string[] {
  if (listed) return listed;
  const under = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && existsSync(path.join(root, e.name, MANIFEST)))
    .map((e) => e.name)
    .sort();
  return [...(existsSync(path.join(root, MANIFEST)) ? ['.'] : []), ...under];
}

/** The packages the product's manifests list. A listed folder with no package.json, or a manifest that is not JSON, stops the load. */
export function readPackageFacts(root: string, listed: string[] | null): PackageFact[] {
  const facts: PackageFact[] = [];
  for (const folder of manifestFolders(root, listed)) {
    const manifest = folder === '.' ? MANIFEST : `${folder}/${MANIFEST}`;
    const file = path.join(root, manifest);
    if (!existsSync(file)) throw new Error(`${CONFIG_FILE}: packages names ${folder}, which holds no ${MANIFEST}.`);
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`${manifest} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (typeof json !== 'object' || json === null) continue;
    for (const section of SECTIONS) {
      const names = (json as Record<string, unknown>)[section];
      if (typeof names !== 'object' || names === null || Array.isArray(names)) continue;
      for (const name of Object.keys(names).sort()) facts.push({ manifest, package: name });
    }
  }
  return facts;
}

/** The table the engine fills with the packages before the checks run. */
export const PACKAGE_FACTS_SQL = `CREATE OR REPLACE TABLE package_facts (manifest VARCHAR NOT NULL, package VARCHAR NOT NULL);`;

/**
 * The package-not-accounted-for gap, one per product: the packages its manifests list that no record of the product
 * names, each with the manifests that list it. (id, message), as a gap rule's query returns.
 */
export const PACKAGE_GAP_SQL = `
WITH unaccounted AS (
  SELECT p.id AS product, f.package, string_agg(DISTINCT f.manifest, ', ' ORDER BY f.manifest) AS manifests
  FROM product p CROSS JOIN package_facts f
  WHERE NOT EXISTS (SELECT 1 FROM package_use u JOIN record_scope s ON s.id = u.record_id WHERE u.package = f.package AND s.product_id = p.id)
  GROUP BY p.id, f.package
)
SELECT product AS id,
  'Product ' || product || ' depends on ' || CASE WHEN count(*) = 1 THEN 'a package' ELSE count(*) || ' packages' END
    || ' no record uses: ' || string_agg(package || ' (' || manifests || ')', ', ' ORDER BY package) || '.' AS message
FROM unaccounted GROUP BY product`;
