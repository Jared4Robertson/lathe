import { plural } from '../plural';
import { textOf, kindLabel, type SpecIndex, type SpecRecord } from './data';
import { RecordTree, Section } from './parts';

// An API's page lists its endpoints and the interaction requirements they share, and an
// integration's page lists its exchanges, one interaction requirement each (lathe/REFERENCE.md).

const childrenOf = (index: SpecIndex, id: string, kind: string) => (index.children.get(id) ?? []).filter((c) => c.kind === kind);

/** The kinds whose page lists its children in sections of its own, in place of a plain list of children. */
export const hasOwnChildSections = (kind: string) => kind === 'api' || kind === 'integration';

export function ApiSections({ index, api }: { index: SpecIndex; api: SpecRecord }) {
  const endpoints = childrenOf(index, api.id, 'endpoint');
  const shared = childrenOf(index, api.id, 'interaction_requirement');
  const endpointsTitle = plural(kindLabel(index, 'endpoint'));
  return (
    <>
      <Section title={endpointsTitle} count={endpoints.length}>
        {endpoints.length === 0
          ? <p className="hint">This API has no endpoints yet.</p>
          : <RecordTree index={index} records={endpoints} label={`${endpointsTitle} of ${api.id}`} />}
      </Section>
      <Section title="Shared requirements" count={shared.length}>
        <p className="hint">Interaction requirements that hold for every endpoint in this API.</p>
        {shared.length > 0 && <RecordTree index={index} records={shared} label={`Shared requirements of ${api.id}`} />}
      </Section>
    </>
  );
}

export function IntegrationSections({ index, integration }: { index: SpecIndex; integration: SpecRecord }) {
  const exchanges = childrenOf(index, integration.id, 'interaction_requirement');
  const system = textOf(integration.row, 'system')?.trim();
  return (
    <Section title="Exchanges" count={exchanges.length}>
      <p className="hint">
        {system ? <>What the domain exchanges with {system}, one interaction requirement each.</> : <>What the domain exchanges with this system, one interaction requirement each.</>}
      </p>
      {exchanges.length > 0 && <RecordTree index={index} records={exchanges} label={`Exchanges of ${integration.id}`} />}
    </Section>
  );
}
