import type { LibraryPage as Library } from '../../../../lathe/src/domain-modeling/library/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { RowsSection, Summary, Text, readState, type Fact } from '../../record/page-parts';
import { RecordLink } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { LibraryEditor } from './LibraryEditor';
import { useLibrary } from './reads';

// The Library page (LA-MOD-A26's page, LA-V160): a library at its address (/<id>), drawn from its page read through the aggregate's
// own query (GET /api/library/get-library, read model LA-MOD-RM46) and changed only through its own commands (LibraryEditor):
// its description, then the guarantees it makes, each a row leading to it, or that none is written yet; the business
// outcomes it serves are among its links. What every record's page holds around that (traceability, problems, facts and
// links) is the Record page's (RecordFrame).

/** The library's description and the guarantees it makes. */
function Content({ index, page }: { index: RecordIndex; page: Library }) {
  const { id, description } = page.library;
  return (
    <>
      <Text index={index} id={id} source={description} field="description" />
      <RowsSection index={index} title="Guarantees" ids={page.guarantees.map((g) => g.id)} label={`The guarantees ${id} makes`} empty="The guarantees it makes are not written yet." />
    </>
  );
}

/** The library's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: Library): { lead?: string; facts: Fact[] } {
  return {
    lead: page.library.description,
    facts: [
      { label: 'Domain', value: <RecordLink index={index} id={page.library.domain_id} /> },
      { label: 'Guarantees', value: page.guarantees.length },
      { label: 'Serves', value: page.serves.length },
    ],
  };
}

/** A library: its page (or its summary in the wiki card), with its editor's actions. */
export function LibraryPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useLibrary(id, index);
  const state = readState(index, id, read, (answer) => answer.library.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <LibraryEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="library">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </LibraryEditor>
  );
}
