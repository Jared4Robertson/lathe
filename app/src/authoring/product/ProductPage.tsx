import type { ReactNode } from 'react';
import type { ByCapability, InterfaceEntry, ProductPage as Product, QuestionEntry } from '../../../../lathe/src/authoring/product/read-model';
import { LimitsSection } from '../../checking/product-setting/LimitsSection';
import { Button } from '../../components/Button';
import { LongList } from '../../components/LongList';
import { Refusal, problemText } from '../../edit/fields';
import type { AggregatePageProps } from '../../record/pages';
import { Card, CardGrid } from '../../shell/Card';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { Markdown } from '../../specs/Markdown';
import { Prose } from '../../specs/mentions';
import { ProblemBadge, ProblemList, RecordLink, Section } from '../../specs/parts';
import { CoverageBars, ProductSummary } from '../../specs/ProductHealth';
import { RecordFrame } from '../../specs/RecordContent';
import { problemsUnder, StageSections } from '../../specs/SpecPages';
import { ownerFolders } from '../../exploring/folder-tree/folders';
import { addressOf } from '../../views/address';
import { kindInProduct, ProductEditor, type DeclarationActions, type ProductRecordKind } from './ProductEditor';
import { useTraceRows } from '../../traceability/trace/reads';
import { proofLine } from '../journey/JourneyLine';
import { useProduct } from './reads';

// The Product page (LA-AUT-A1's page, LA-V51): a product at its ID (/<id>), and its open questions and interfaces, each
// at its own address, drawn from the product's page read through the aggregate's own query (GET
// /api/product/get-product) and changed only through its own commands (ProductEditor). A product shows its description,
// its discovery (business outcomes and journeys), its domains as cards with their coverage, what it shares in its stages, its summary, its roles,
// its interfaces, the kinds and relations it declares as its own, its open questions and its problems; an open question
// its description, owner, where it sits and what it is about; an interface its kind, its description, the roles that
// use it, the patterns it follows, the use cases it offers and those it does not, by capability. The coverage, the stages' folders and problems still come from the
// workspace's index until the stage reads land; what every record's page holds around its content is the Record page's.

/** A text of the record, read as Markdown with the IDs it names as links, under its heading or as the page's lead. */
function Text({ index, id, source, title, field }: { index: RecordIndex; id: string; source: string | undefined; title?: string; field: string }) {
  if (!source?.trim()) return null;
  const prose = <Prose index={index} source={source} self={id} />;
  return title ? <Section title={title} className={`record-${field}`}>{prose}</Section> : <div className="record-lead" data-field={field}>{prose}</div>;
}

/** Short facts of the record, as a definition list. */
function Facts({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  if (facts.length === 0) return null;
  return <dl className="fields product-facts">{facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>;
}

/** The product's business outcomes: each with its statement, measure, target and the capabilities that serve it. */
function BusinessOutcomes({ index, page }: { index: RecordIndex; page: Product }) {
  return (
    <Section title="Business outcomes" count={page.outcomes.length} level={3} className="stage stage-discovery product-outcomes">
      <p className="hint">What the product exists to achieve, each measurable, and the capabilities that serve it.</p>
      {page.outcomes.length === 0 && <p className="hint">No business outcomes yet.</p>}
      <CardGrid stack label="Business outcomes">
        {page.outcomes.map((o) => (
          <Card key={o.id} accent href={addressOf(o.id)} title={<><code>{o.id}</code><strong>{o.title}</strong></>}>
            <div className="outcome-statement"><Prose index={index} source={o.statement} self={o.id} /></div>
            <dl className="fields outcome-fields">
              <div><dt>Measure</dt><dd><Prose index={index} source={o.measure} self={o.id} /></dd></div>
              <div><dt>Target</dt><dd><Prose index={index} source={o.target} self={o.id} /></dd></div>
              <div>
                <dt>Served by</dt>
                <dd>
                  {o.servedBy.length === 0 ? <span className="hint">No capability yet.</span> : (
                    <ul className="plain served-by">{o.servedBy.map((c) => <li key={c}><RecordLink index={index} id={c} /></li>)}</ul>
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </CardGrid>
    </Section>
  );
}

/** The product's journeys, each a card with its steps count and how far it is proved, and how many of its use cases some journey carries out. */
function Journeys({ index, product }: { index: RecordIndex; product: string }) {
  const read = useTraceRows(product, index);
  const trace = read.state === 'read' && read.answer.product === product ? read.answer : null;
  const journeys = [...index.byId.values()].filter((r) => r.kind === 'journey' && r.product === product);
  const inJourney = trace ? trace.rows.filter((r) => r.journeys.length > 0).length : 0;
  return (
    <Section title="Journeys" count={journeys.length} level={3} className="stage stage-discovery product-journeys">
      <p className="hint">The use cases and handoffs, in order, from a trigger to a result, each serving the outcomes above.</p>
      {journeys.length === 0 && <p className="hint">No journeys yet.</p>}
      <CardGrid stack label="Journeys">
        {journeys.map((j) => {
          const proof = trace?.journeys.find((t) => t.id === j.id);
          return (
            <Card key={j.id} accent href={addressOf(j.id)} title={<><code>{j.id}</code><strong>{j.title}</strong></>}>
              {proof && <p className={`journey-line-proof${proof.proved ? ' is-proved' : ''}`} data-meta="proof">{proof.proved ? '✓ ' : ''}{proofLine(proof)}</p>}
            </Card>
          );
        })}
      </CardGrid>
      {trace && <p className="hint" data-fact="use-cases-in-journeys">Use cases in a journey: {inJourney} of {trace.rows.length}</p>}
    </Section>
  );
}

/** The product's open questions, each with its owner and what it is about. */
function Questions({ index, questions }: { index: RecordIndex; questions: QuestionEntry[] }) {
  return (
    <Section title="Open questions" count={questions.length}>
      {questions.length === 0 ? <p className="hint">No open questions.</p> : (
        <LongList label="Open questions" className="record-list" items={questions} itemKey={(q) => q.id} searchText={(q) => `${q.id} ${q.title}`}
          render={(q) => (
            <>
              <RecordLink index={index} id={q.id} row />
              <small className="meta">
                owner {q.owner}
                {q.about.map((a) => <span key={a}> · about <RecordLink index={index} id={a} showTitle={false} /></span>)}
              </small>
            </>
          )} />
      )}
    </Section>
  );
}

/** How many use cases of the product an interface offers, or does not. */
const offered = (iface: InterfaceEntry, which: 'offers' | 'missing' = 'offers') => iface[which].reduce((n, g) => n + g.items.length, 0);

/** The product's roles, interfaces, and the kinds and relations it declares as its own, with each declaration's actions. */
function Declarations({ index, page, actions }: { index: RecordIndex; page: Product; actions: DeclarationActions | null }) {
  return (
    <>
      <Section title="Roles" count={page.roles.length} className="product-roles">
        {page.roles.length === 0 ? <p className="hint">No roles yet.</p> : (
          <dl className="fields">{page.roles.map((r) => <div key={r.name}><dt>{r.name}</dt><dd>{r.description}</dd></div>)}</dl>
        )}
      </Section>
      <Section title="Interfaces" count={page.interfaces.length} className="product-interfaces">
        {page.interfaces.length === 0 ? <p className="hint">No interfaces yet.</p> : (
          <ul className="plain record-list">
            {page.interfaces.map((i) => (
              <li key={i.id}>
                <div className="record-row">
                  <RecordLink index={index} id={i.id} row />
                  <span className="row-tags">
                    <small className="meta">{i.kind}</small>
                    {i.actors.length > 0 && <small className="meta" data-meta="roles">{i.actors.join(', ')}</small>}
                    <small className="meta" data-meta="offers">offers {offered(i)} of {offered(i) + offered(i, 'missing')}</small>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Product kinds" count={page.kinds.length} className="product-kinds">
        {page.kinds.length === 0 ? <p className="hint">The product declares no kinds of its own.</p> : (
          <ul className="plain declarations" aria-label="Product kinds">
            {page.kinds.map((k) => (
              <li key={k.name} className="declaration">
                <p><code>{k.name}</code> <strong>{k.label}</strong> <small className="meta">under {k.parent_kind}{k.stage ? ` · ${k.stage}` : ''}{k.obligation ? ' · obligation' : ''}</small></p>
                <p className="hint">{k.description}</p>
                {k.fields.length > 0 && <p className="declaration-fields">Fields: {k.fields.map((f) => `${f.name} (${f.type}${f.required ? ', required' : ''})`).join(', ')}</p>}
                {actions && (
                  <span className="declaration-actions">
                    <Button onClick={() => actions.changeKind(k.name)} aria-label={`Change the product kind ${k.name}`}>Change</Button>
                    <Button danger onClick={() => actions.removeKind(k.name)} aria-label={`Remove the product kind ${k.name}`}>Remove</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Product relations" count={page.relations.length} className="product-relations">
        {page.relations.length === 0 ? <p className="hint">The product declares no relations of its own.</p> : (
          <ul className="plain declarations" aria-label="Product relations">
            {page.relations.map((r) => (
              <li key={`${r.name} ${r.source_kind} ${r.target_kind}`} className="declaration">
                <p><code>{r.name}</code> <small className="meta">{r.source_kind} → {r.target_kind}{r.role ? ` · ${r.role}` : ''}</small></p>
                <p className="hint">{r.forward_label} / {r.reverse_label}</p>
                {actions && (
                  <span className="declaration-actions">
                    <Button onClick={() => actions.changeRelation(r)} aria-label={`Change the product relation ${r.name}`}>Change</Button>
                    <Button danger onClick={() => actions.removeRelation(r)} aria-label={`Remove the product relation ${r.name}`}>Remove</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

/** How many journeys the product has. */
const countJourneys = (index: RecordIndex, product: string) => [...index.byId.values()].filter((r) => r.kind === 'journey' && r.product === product).length;

/** The product's own page: its outcomes, domains, shared records, summary, declarations, open questions and problems. */
function ProductContent({ index, page, actions }: { index: RecordIndex; page: Product; actions: DeclarationActions | null }) {
  const id = page.product.id;
  const problems = problemsUnder(index, 'product', id);
  // Its discovery (business outcomes and journeys) has a section of its own, so Shared holds the other stages.
  const shared = ownerFolders(index, id).stages.filter((s) => s.stage !== 'discovery' && s.count > 0);
  const ownCount = shared.reduce((n, s) => n + s.count, 0);
  return (
    <div className="spec-body" data-aggregate="product">
      <Text index={index} id={id} source={page.product.description} field="description" />
      <Text index={index} id={id} source={page.product.notes} title="Notes" field="notes" />
      <Section title="Discovery" count={page.outcomes.length + countJourneys(index, id)} className="product-discovery">
        <BusinessOutcomes index={index} page={page} />
        <Journeys index={index} product={id} />
      </Section>
      <Section title="Domains" count={page.domains.length}>
        {page.domains.length === 0 && <p className="hint">No domains yet.</p>}
        <CardGrid label="Domains">
          {page.domains.map((d) => (
            <Card key={d.id} href={addressOf(d.id)} title={<><code>{d.id}</code><strong>{d.title}</strong></>}>
              <CoverageBars coverage={index.coverage.get(d.id)} />
              <ProblemBadge problems={problems.filter((p) => index.byId.get(p.record!)?.domain === d.id)} />
            </Card>
          ))}
        </CardGrid>
      </Section>
      {ownCount > 0 && (
        <Section title="Shared" count={ownCount} className="product-shared">
          <p className="hint">Patterns and standards, and the records with no owner that two or more domains use, or none, with what sits under them.</p>
          <StageSections index={index} folders={{ stages: shared, loose: [] }} query="" level={3} />
          {index.coverage.get(id) && (
            <Section level={3} title="Shared coverage" className="product-coverage">
              <CoverageBars coverage={index.coverage.get(id)} />
            </Section>
          )}
        </Section>
      )}
      <Section title="Summary">
        <ProductSummary index={index} productId={id} />
      </Section>
      <LimitsSection index={index} product={id} />
      <Declarations index={index} page={page} actions={actions} />
      <Questions index={index} questions={page.questions} />
      <Section title="Problems in this product" count={problems.length}>
        <ProblemList index={index} problems={problems} />
      </Section>
    </div>
  );
}

/** Records grouped under the capabilities of the product, each group a section linked to its capability. */
function ByCapabilities<T extends { id: string }>({ groups, label, render }: { groups: ByCapability<T>[]; label: string; render: (item: T) => ReactNode }) {
  return (
    <>
      {groups.map(({ capability, items }) => (
        <Section key={capability.id} title={capability.title} titleTo={addressOf(capability.id)} count={items.length} level={3} className="record-group">
          <LongList label={`${label}: ${capability.title}`} className="record-list" items={items} itemKey={(r) => r.id} searchText={(r) => r.id} render={render} />
        </Section>
      ))}
    </>
  );
}

/** The use cases an interface offers by capability, and the product's use cases it does not offer (LA-V51-R09). */
function InterfaceOffers({ index, iface }: { index: RecordIndex; iface: InterfaceEntry }) {
  return (
    <>
      <Section title="Use cases it offers" count={offered(iface)} className="interface-offers">
        {iface.offers.length === 0 ? <p className="hint">It offers no use case yet.</p> : (
          <ByCapabilities groups={iface.offers} label={`Use cases ${iface.id} offers`} render={(useCase) => (
            <div className="record-row">
              <RecordLink index={index} id={useCase.id} row />
              <span className="row-tags"><ProblemBadge problems={index.problemsFor.get(useCase.id) ?? []} /></span>
            </div>
          )} />
        )}
      </Section>
      <Section title="Use cases it does not offer" count={offered(iface, 'missing')} className="interface-missing">
        {iface.missing.length === 0 ? <p className="hint">It offers every use case of the product.</p> : (
          <ByCapabilities groups={iface.missing} label={`Use cases ${iface.id} does not offer`} render={(useCase) => (
            <div className="record-row"><RecordLink index={index} id={useCase.id} row /></div>
          )} />
        )}
      </Section>
    </>
  );
}

/** What an open question or an interface shows on its page. */
function RecordContentOf({ index, page, id, kind }: { index: RecordIndex; page: Product; id: string; kind: Exclude<ProductRecordKind, 'product'> }) {
  if (kind === 'question') {
    const q = page.questions.find((x) => x.id === id)!;
    return (
      <>
        <Text index={index} id={id} source={q.description} field="description" />
        <Facts facts={[{ label: 'Owner', value: q.owner }, { label: 'Under', value: <RecordLink index={index} id={q.domain_id ?? q.product_id ?? page.product.id} /> }]} />
        {q.about.length > 0 && (
          <Section title="About" count={q.about.length} level={3}>
            <ul className="plain record-list">{q.about.map((a) => <li key={a}><RecordLink index={index} id={a} row /></li>)}</ul>
          </Section>
        )}
      </>
    );
  }
  const iface = page.interfaces.find((x) => x.id === id)!;
  return (
    <>
      <Text index={index} id={id} source={iface.description} field="description" />
      <Facts facts={[
        { label: 'Kind', value: iface.kind },
        { label: iface.actors.length === 1 ? 'Role' : 'Roles', value: iface.actors.length ? iface.actors.join(', ') : <span className="hint">None named: the main actor of each use case</span> },
        ...(iface.patterns.length ? [{ label: 'Patterns', value: <ul className="plain">{iface.patterns.map((p) => <li key={p}><RecordLink index={index} id={p} /></li>)}</ul> }] : []),
      ]} />
      <InterfaceOffers index={index} iface={iface} />
    </>
  );
}

/** The record's summary in the wiki card: its lead text and a few key facts. */
function Summary({ index, page, id, kind }: { index: RecordIndex; page: Product; id: string; kind: ProductRecordKind }) {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const { lead, facts } = ((): { lead: string; facts: { label: string; value: ReactNode }[] } => {
    switch (kind) {
      case 'product':
        return { lead: page.product.description, facts: [{ label: 'Holds', value: `${count(page.domains.length, 'domain', 'domains')}, ${count(page.outcomes.length, 'business outcome', 'business outcomes')}` }, { label: 'Open questions', value: page.questions.length }] };
      case 'question': {
        const q = page.questions.find((x) => x.id === id)!;
        return { lead: q.description, facts: [{ label: 'Owner', value: q.owner }, { label: 'Under', value: <RecordLink index={index} id={q.domain_id ?? q.product_id ?? page.product.id} /> }] };
      }
      case 'interface': {
        const iface = page.interfaces.find((x) => x.id === id)!;
        return { lead: iface.description, facts: [{ label: 'Kind', value: iface.kind }, { label: 'Offers', value: count(offered(iface), 'use case', 'use cases') }] };
      }
    }
  })();
  return (
    <>
      {lead && <div className="wiki-panel-lead"><Markdown source={lead} /></div>}
      <Facts facts={facts} />
    </>
  );
}

/** A product, an open question or an interface: its page (or its summary in the wiki card), with its editor's actions. */
export function ProductPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useProduct(id, index);
  const record = index.byId.get(id);
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  if (!record) return <div className={body}><p>There's no record with the ID <code>{id}</code>.</p></div>;
  if (read.state === 'refused') {
    return <div className={body}><Refusal title={`${id} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} /></div>;
  }
  // Until the product is read (or while the read is of data before the record was added), the page says so.
  const page = read.state === 'read' ? read.answer : null;
  const kind = page ? kindInProduct(page, id) : undefined;
  if (!page || !kind) return <div className={body}><p className="hint" role="status">Reading {id}…</p></div>;
  return (
    <ProductEditor index={index} page={page} id={id} kind={kind}>
      {(actions) => (summary ? (
        <div className={body}><Summary index={index} page={page} id={id} kind={kind} />{after}</div>
      ) : kind === 'product' ? (
        <>
          <ProductContent index={index} page={page} actions={actions} />
          {after}
        </>
      ) : (
        <div className={body} data-aggregate="product">
          <RecordFrame index={index} record={record}><RecordContentOf index={index} page={page} id={id} kind={kind} /></RecordFrame>
          {after}
        </div>
      ))}
    </ProductEditor>
  );
}
