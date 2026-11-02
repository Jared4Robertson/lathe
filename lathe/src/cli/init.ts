// `lathe init` (LA-PLT-CMD21): sets Lathe up in a product repo. It writes lathe.config.json, with this Lathe's schema
// version and the data folder, when the repo has none, and then adds the product with the Product aggregate's own
// command, Add a product (LA-PRD-CMD120).
import path from 'node:path';
import { CONFIG_FILE, SCHEMA_VERSION } from '../config.ts';
import { ProductRepoConfigRepository } from '../platform/product-repo/repository.ts';
import { ADD_PRODUCT } from '../product/product/commands/add-product.ts';
import { InputError } from '../platform/commands/definition.ts';
import { runCommand } from '../platform/commands/run.ts';
import { StoreError } from '../platform/data/problems.ts';
import { openStore } from '../platform/data/store.ts';

/** A refusal of init's input or of its write: nothing more is written. */
export class InitError extends Error {}

/** Sets up the product repo at root as the product `name` with the ID prefix `prefix`; returns a line per file written. */
export async function initProduct(root: string, name: string | undefined, prefix: string | undefined): Promise<string[]> {
  const title = name?.trim();
  const id = prefix?.trim();
  if (!title || !id) throw new InitError('lathe init needs --name and --prefix, for example: lathe init --name "Tool Library" --prefix TL');
  if (!/^[A-Z][A-Z0-9]*$/.test(id)) throw new InitError('--prefix must be capital letters and digits, starting with a letter, such as TL.');

  const written: string[] = [];
  const config = new ProductRepoConfigRepository(root);
  if (!config.exists()) {
    config.save({ schema: SCHEMA_VERSION, data: 'data' });
    written.push(`Wrote ${CONFIG_FILE}`);
  }
  const store = await openStore(root);
  try {
    if (store.record(id)) throw new InitError(`The product ${id} already exists.`);
    const { files } = await runCommand(store, ADD_PRODUCT, { id, title, description: `What ${title} is, who it is for, and what it must do.` });
    for (const file of files) written.push(`Wrote ${path.relative(root, path.join(store.dataDir, file))}`);
  } catch (error) {
    if (error instanceof StoreError || error instanceof InputError) throw new InitError(error.message);
    throw error;
  } finally {
    await store.close();
  }
  return written;
}

/** What init says to do next. */
export const INIT_NEXT =
  'Next: add a domain under the product (`lathe domain add-domain --help`), then its aggregates, commands and events, and run `lathe check`. ' +
  '`lathe help` lists every aggregate\'s commands; the tables and their columns are in REFERENCE.md.';
