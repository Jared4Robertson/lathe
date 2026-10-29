import type { ComponentType, ReactNode } from 'react';
import type { DomainKind } from '../../../lathe/src/authoring/domain/model';
import type { PatternKind } from '../../../lathe/src/authoring/pattern/model';
import type { StandardKind } from '../../../lathe/src/authoring/standard/model';
import type { UseCaseKind } from '../../../lathe/src/authoring/use-case/model';
import { AddDomainForm } from '../authoring/domain/DomainEditor';
import { DomainPage } from '../authoring/domain/DomainPage';
import { AddPatternForm } from '../authoring/pattern/PatternEditor';
import { PatternPage } from '../authoring/pattern/PatternPage';
import { AddStandardForm } from '../authoring/standard/StandardEditor';
import { StandardPage } from '../authoring/standard/StandardPage';
import { AddTestDataSetForm } from '../authoring/test-data-set/TestDataSetEditor';
import { TestDataSetPage } from '../authoring/test-data-set/TestDataSetPage';
import { AddUseCaseForm } from '../authoring/use-case/UseCaseEditor';
import { UseCasePage } from '../authoring/use-case/UseCasePage';
import type { SpecIndex } from '../specs/data';

// The Record page's typed list of aggregate pages: each kind of an aggregate that has its own slice in the app
// (app/src/<domain>/<aggregate>/) names that aggregate's page, which reads the aggregate whole and changes it only
// through the aggregate's own commands. The Record page shell (the wiki card) finds a kind's page here; a kind whose
// aggregate has no page yet still shows the record content read from the workspace (specs/RecordContent.tsx), until
// its aggregate's slice adds its kinds to this list. Adding an aggregate's root from the page it sits under (a use
// case from its capability's page) goes through its aggregate's own Add form, listed in ADDERS.

export interface AggregatePageProps {
  index: SpecIndex;
  /** The record the page is at: the aggregate's root or any record inside it. */
  id: string;
  /** The wiki card's summary (its lead and key facts) in place of the whole page. */
  summary?: boolean;
  /** What follows the page's content: the card's changes and history. */
  after?: ReactNode;
}

/** The kinds with an aggregate page. */
type PagedKind = UseCaseKind | DomainKind | 'test_data_set' | PatternKind | StandardKind;

/** Each kind with its aggregate's page. */
const PAGES: { readonly [K in PagedKind]: ComponentType<AggregatePageProps> } = {
  use_case: UseCasePage,
  uc_requirement: UseCasePage,
  use_case_test: UseCasePage,
  flow: UseCasePage,
  flow_step: UseCasePage,
  flow_test: UseCasePage,
  domain: DomainPage,
  capability: DomainPage,
  term: DomainPage,
  domain_service: DomainPage,
  service: DomainPage,
  domain_service_test: DomainPage,
  repository: DomainPage,
  test_data_set: TestDataSetPage,
  pattern: PatternPage,
  pattern_rule: PatternPage,
  pattern_rule_test: PatternPage,
  standard: StandardPage,
  standard_rule: StandardPage,
  standard_rule_test: StandardPage,
};

/** The page of the kind's aggregate, or undefined while its aggregate has none. */
export const pageOf = (kind: string): ComponentType<AggregatePageProps> | undefined => (Object.hasOwn(PAGES, kind) ? PAGES[kind as PagedKind] : undefined);

export interface AggregateAdderProps {
  index: SpecIndex;
  /** The record it is added under, from whose page. */
  parent: string;
  onDone: () => void;
}

/** Each aggregate root added from the page of what it sits under, with its aggregate's Add form. */
const ADDERS: { readonly [K in 'use_case' | 'domain' | 'test_data_set' | 'pattern' | 'standard']: ComponentType<AggregateAdderProps> } = {
  use_case: AddUseCaseForm,
  domain: AddDomainForm,
  test_data_set: AddTestDataSetForm,
  pattern: AddPatternForm,
  standard: AddStandardForm,
};

/** The Add form of the kind's aggregate, or undefined while its aggregate has none. */
export const adderOf = (kind: string): ComponentType<AggregateAdderProps> | undefined => (Object.hasOwn(ADDERS, kind) ? ADDERS[kind as keyof typeof ADDERS] : undefined);
