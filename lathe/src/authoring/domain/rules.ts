// The Domain aggregate's rules, written once: each command's handler runs them on the instance before it saves, and
// every load and commit runs them over all data (domainRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type ReadView, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { DOMAIN_AGGREGATE, domainsFrom, type Domain } from './model.ts';

/**
 * Every rule the domain breaks (LA-AUT-INV112 a domain service has at most one service; LA-AUT-INV41 an aggregate has
 * one repository: a repository share names an aggregate no repository persists; LA-AUT-INV60 a term never builds on
 * itself; LA-AUT-INV17 each capability has its own position). The view gives the persists links of the other domains'
 * repositories and the builds_on links of the other domains' terms.
 */
export function domainProblems(domain: Domain, view: ReadView): RuleProblem[] {
  return [...repositoryShareProblems(domain, view), ...buildsOnLoops(domain, view), ...capabilityPositions(domain)];
}

/** LA-AUT-INV17: no two capabilities of the domain have the same position; each after the first at one is refused. */
function capabilityPositions(domain: Domain): RuleProblem[] {
  const first = new Map<number, string>();
  const problems: RuleProblem[] = [];
  for (const { row } of domain.capabilities) {
    const holder = first.get(row.position);
    if (holder === undefined) first.set(row.position, row.id);
    else {
      problems.push({
        rule: 'capability-position',
        table: 'capability',
        row: row as unknown as Row,
        message: `capability ${holder} is at position ${row.position} of domain ${domain.root}, so ${row.id} cannot be too: each capability of a domain has its own position`,
      });
    }
  }
  return problems;
}

/**
 * Every persists link that breaks LA-AUT-INV40: a repository persists at most one aggregate. Each link after the first
 * of its repository is refused. (One that persists none is reported by repository-persists-nothing until its link is
 * written.)
 */
export function repositoryPersistsOne(links: readonly { source_id: string; target_id: string }[]): RuleProblem[] {
  const first = new Map<string, string>();
  const problems: RuleProblem[] = [];
  for (const link of links) {
    const persisted = first.get(link.source_id);
    if (persisted === undefined) first.set(link.source_id, link.target_id);
    else {
      problems.push({
        rule: 'repository-persists-one',
        table: 'persists',
        row: link as unknown as Row,
        message: `repository ${link.source_id} already persists ${persisted}, so it cannot also persist ${link.target_id}: a repository persists one aggregate`,
      });
    }
  }
  return problems;
}

// LA-AUT-INV41: a repository share names an aggregate no repository persists, never its repository's own.
function repositoryShareProblems(domain: Domain, view: ReadView): RuleProblem[] {
  const own = new Set(domain.repositories.map((r) => r.row.id));
  const persistedBy = new Map<string, string>();
  for (const link of view.rows('persists')) if (!own.has(String(link.source_id))) persistedBy.set(String(link.target_id), String(link.source_id));
  for (const repository of domain.repositories) if (repository.persists !== null) persistedBy.set(repository.persists, repository.row.id);
  const problems: RuleProblem[] = [];
  for (const repository of domain.repositories) {
    for (const share of repository.shares) {
      const persister = persistedBy.get(share.aggregate_id);
      if (persister === undefined) continue;
      problems.push({
        rule: 'repository-share-unpersisted',
        table: 'repository_share',
        row: share as unknown as Row,
        message: `${share.repository_id} cannot also record ${share.aggregate_id}, ${persister === share.repository_id ? 'the aggregate it persists' : `which ${persister} persists: an aggregate has one repository`}`,
      });
    }
  }
  for (const service of beyondFirst(domain.services.map((x) => x.row), (r) => r.domain_service_id)) {
    problems.push({
      rule: 'one-service',
      table: 'service',
      row: service as unknown as Row,
      message: `domain service ${service.domain_service_id} already has its service, so ${service.id} cannot be a second: a domain service has one`,
    });
  }
  return problems;
}

/**
 * LA-AUT-INV60 a term never builds on itself: no chain of builds_on links from a term of the domain comes back to it.
 * Each loop is named once, from its lowest term ID along the shortest way back, by title: "Entity → Aggregate →
 * Entity". The links of the product's other domains' terms come from the view, the domain's own from the instance.
 */
function buildsOnLoops(domain: Domain, view: ReadView): RuleProblem[] {
  const own = new Set(domain.terms.map((t) => t.row.id));
  const next = new Map<string, string[]>();
  const title = new Map<string, string>();
  for (const term of view.rows('term')) if (!own.has(String(term.id))) title.set(String(term.id), String(term.title));
  for (const link of view.rows('builds_on')) {
    const source = String(link.source_id);
    if (!own.has(source)) next.set(source, [...(next.get(source) ?? []), String(link.target_id)]);
  }
  for (const term of domain.terms) {
    title.set(term.row.id, term.row.title);
    next.set(term.row.id, [...term.buildsOn]);
  }
  const problems: RuleProblem[] = [];
  const named = new Set<string>();
  for (const loop of loopsThrough([...own].sort(byId), next)) {
    const start = loop.reduce((low, id) => (byId(id, low) < 0 ? id : low));
    const at = loop.indexOf(start);
    const from = [...loop.slice(at), ...loop.slice(0, at)];
    const shortest = wayBack(from[0], next) ?? from;
    const key = shortest.join(' ');
    if (named.has(key)) continue;
    named.add(key);
    const words = [...shortest, shortest[0]].map((id) => title.get(id) ?? id).join(' → ');
    problems.push({
      rule: 'term-builds-on-itself',
      table: 'builds_on',
      row: { source_id: shortest[0], target_id: shortest[1] ?? shortest[0] },
      message: `${shortest[0]} builds on itself: ${words}; define the lower term in plain words, without the term it leads back to`,
    });
  }
  return problems;
}

const byId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

// Each loop the links make through one of the starting terms, as the terms along it.
function loopsThrough(starts: string[], next: Map<string, string[]>): string[][] {
  const loops: string[][] = [];
  const done = new Set<string>();
  for (const start of starts) {
    const path: string[] = [];
    const onPath = new Set<string>();
    const visit = (id: string): void => {
      if (onPath.has(id)) {
        loops.push(path.slice(path.indexOf(id)));
        return;
      }
      if (done.has(id)) return;
      path.push(id);
      onPath.add(id);
      for (const target of next.get(id) ?? []) visit(target);
      path.pop();
      onPath.delete(id);
      done.add(id);
    };
    visit(start);
  }
  return loops;
}

// The shortest chain of links from the term back to itself, as the terms along it, or undefined.
function wayBack(start: string, next: Map<string, string[]>): string[] | undefined {
  const cameFrom = new Map<string, string>();
  const queue = [...(next.get(start) ?? [])].sort(byId);
  for (const id of queue) if (!cameFrom.has(id)) cameFrom.set(id, start);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === start) {
      const chain: string[] = [];
      for (let at = cameFrom.get(start)!; at !== start; at = cameFrom.get(at)!) chain.unshift(at);
      return [start, ...chain];
    }
    for (const target of [...(next.get(id) ?? [])].sort(byId)) {
      if (cameFrom.has(target)) continue;
      cameFrom.set(target, id);
      queue.push(target);
    }
  }
  return undefined;
}

/** The rules over all data: every domain, whole. A loop through several domains' terms is named once. */
export const domainRules: AggregateRules = {
  aggregate: DOMAIN_AGGREGATE,
  check: (view) => {
    const named = new Set<string>();
    const once = (p: RuleProblem) => {
      if (p.rule !== 'term-builds-on-itself') return true;
      if (named.has(p.message)) return false;
      named.add(p.message);
      return true;
    };
    return [
      ...domainsFrom((table) => view.rows(table)).flatMap((domain) => domainProblems(domain, view)).filter(once),
      ...repositoryPersistsOne(view.rows('persists') as unknown as { source_id: string; target_id: string }[]),
    ];
  },
};

/** Refuses the command, with every reason, when the domain as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, domain: Domain): void {
  const problems = domainProblems(domain, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
