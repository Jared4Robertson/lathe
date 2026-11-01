// The Folder tree read (LA-EXP-RM02): a product's nav tree, which the nav, Quick open and the graph's tree read,
// answered from the read model through its reader (reader.ts). Its handler never sees the data and changes nothing.
// This slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { FolderEntry, FolderTree, OwnerFolders } from './read-model.ts';
import { folderTreeReader, type FolderTreeReader } from './reader.ts';
import { GET_FOLDER_TREE_IDENTITY } from './queries.generated.ts';

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
  ...GET_FOLDER_TREE_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: folderTreeReader,
  run: getFolderTree,
  text: (t) => [`${t.product} Shared`, ...ownerLines(t.shared, '  '), ...t.domains.flatMap((d) => [`${d.owner} ${d.title}`, ...ownerLines(d, '  ')])].join('\n'),
};
