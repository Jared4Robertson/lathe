// The Folder tree read (LA-EXP-RM02): a product's nav tree, which the nav, Quick open and the graph's tree read,
// answered from the read model through its reader (reader.ts). Its handler never sees the data and changes nothing.
// This slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type AnyQuery, type QueryDefinition, type Slice } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { FolderEntry, FolderTree, OwnerFolders } from './read-model.ts';
import { folderTreeReader, type FolderTreeReader } from './reader.ts';

/** How the interfaces reach the Folder tree read: `lathe folder-tree`, the folder_tree_ tools, /api/folder-tree/. */
const FOLDER_TREE_SLICE: Slice = { aggregate: 'LA-EXP-RM02', name: 'folder-tree' };

/** The product's folder tree: Shared, then each domain's stages and folders. */
export function getFolderTree(reader: FolderTreeReader, input: { product_id: string }): FolderTree {
  const tree = reader.treeOf(input.product_id);
  if (!tree) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return tree;
}

const entryLines = (e: FolderEntry, indent: string): string[] => [`${indent}${e.id} ${e.title}`, ...e.folded.flatMap((f) => entryLines(f, `${indent}  `))];
const ownerLines = (o: OwnerFolders, indent: string): string[] => [
  ...o.stages.flatMap((s) => [`${indent}${s.stage} (${s.count})`, ...s.folders.flatMap((f) => [...(s.direct ? [] : [`${indent}  ${f.kind} (${f.count})`]), ...f.entries.flatMap((e) => entryLines(e, `${indent}${s.direct ? '  ' : '    '}`))])]),
  ...o.loose.flatMap((f) => [`${indent}${f.kind} (${f.count})`, ...f.entries.flatMap((e) => entryLines(e, `${indent}  `))]),
];

/** Get a product's nav (LA-EXP-QRY05). */
export const GET_FOLDER_TREE: QueryDefinition<{ product_id: string }, FolderTree, FolderTreeReader> = {
  id: 'LA-EXP-QRY05',
  slice: FOLDER_TREE_SLICE,
  name: 'get-folder-tree',
  method: 'GET',
  route: '/api/folder-tree/get-folder-tree',
  description: "Gets a product's nav tree: Shared with what the product shares, then each domain in ID order; in each its stages, in each stage one folder per kind in kind order with the records that start a branch there and what folds under each, then the kinds outside the stages.",
  input: { product_id: id('The product.', 'required') },
  reader: folderTreeReader,
  run: getFolderTree,
  text: (t) => [`${t.product} Shared`, ...ownerLines(t.shared, '  '), ...t.domains.flatMap((d) => [`${d.owner} ${d.title}`, ...ownerLines(d, '  ')])].join('\n'),
};

/** The Folder tree read's queries, as the CLI and the MCP server register them. */
export const FOLDER_TREE_QUERIES: readonly AnyQuery[] = [GET_FOLDER_TREE];
