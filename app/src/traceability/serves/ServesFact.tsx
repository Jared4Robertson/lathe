import { checkPagePath } from '../../format/reference';
import { type RecordIndex, type RecordSummary } from '../../exploring/record-summaries/record-index';
import { RecordLink, SpecLink } from '../../specs/parts';
import { useServes } from './reads';

// A record's Serves line (LA-TRC-UC20): the business outcomes it serves, each a link, as the Serves read works them out
// from the use cases that reach it; never typed in. A record none reaches says so, and an aggregate, read model or
// obligation links the serves-no-outcome check that reports it. A business outcome and the product have no line: the
// outcome is what is served, and the product holds the outcomes.

/** The kinds the serves-no-outcome check reports when no outcome reaches them. */
const owesAnOutcome = (index: RecordIndex, kind: string) => !!index.meta.kinds.get(kind)?.obligation || kind === 'aggregate' || kind === 'read_model';

export function ServesFact({ index, record }: { index: RecordIndex; record: RecordSummary }) {
  const read = useServes(record.id, index);
  if (record.kind === 'business_outcome' || record.kind === 'product') return null;
  if (read.state !== 'read' || read.answer.id !== record.id) return null;
  const { outcomes } = read.answer;
  return (
    <div className="serves-fact" data-fact="serves">
      <dt>Serves</dt>
      <dd>
        {outcomes.length > 0 ? (
          <ul className="plain serves-list" aria-label={`Outcomes ${record.id} serves`}>
            {outcomes.map((id) => <li key={id}><RecordLink index={index} id={id} /></li>)}
          </ul>
        ) : (
          <span className="hint">
            No outcome: no use case reaches it.
            {owesAnOutcome(index, record.kind) && <> <SpecLink to={checkPagePath('serves-no-outcome')} className="check-link" title="How the serves-no-outcome check works"><code className="check-name">serves-no-outcome</code></SpecLink></>}
          </span>
        )}
      </dd>
    </div>
  );
}
