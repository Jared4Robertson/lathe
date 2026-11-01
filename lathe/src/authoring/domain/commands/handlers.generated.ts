// Generated from data/ by `npm run generate`. Do not edit.
// The domain commands whose handler is the pattern: load the domain, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import type { AddDomain } from './add-domain.ts';
import type { ChangeDomain } from './change-domain.ts';
import type { RemoveDomain } from './remove-domain.ts';
import type { AddCapability } from './add-capability.ts';
import type { ChangeCapability } from './change-capability.ts';
import type { RemoveCapability } from './remove-capability.ts';
import type { AddTerm } from './add-term.ts';
import type { ChangeTerm } from './change-term.ts';
import type { RemoveTerm } from './remove-term.ts';
import type { AddDomainService } from './add-domain-service.ts';
import type { ChangeDomainService } from './change-domain-service.ts';
import type { RemoveDomainService } from './remove-domain-service.ts';
import type { AddRepository } from './add-repository.ts';
import type { ChangeRepository } from './change-repository.ts';
import type { RemoveRepository } from './remove-repository.ts';
import type { AddService } from './add-service.ts';
import type { ChangeService } from './change-service.ts';
import type { RemoveService } from './remove-service.ts';
import type { AddDomainServiceTest } from './add-domain-service-test.ts';
import type { ChangeDomainServiceTest } from './change-domain-service-test.ts';
import type { RemoveDomainServiceTest } from './remove-domain-service-test.ts';

/** Adds a domain to its product, with nothing in it yet. */
export function addDomain(tx: Transaction, input: AddDomain): void {
  const domains = new DomainRepository(tx);
  const domain = domains.create({ root: input.id, domain: input, capabilities: [], terms: [], domainServices: [], services: [], domainServiceTests: [], repositories: [] });
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Changes a domain's title, subdomain type, description or notes. Its product never changes. */
export function changeDomain(tx: Transaction, input: ChangeDomain): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.id) ?? tx.refuse('missing', `there is no domain ${input.id}`);
  domain.domain = changed(domain.domain, input, ['title', 'subdomain_type', 'description', 'notes']);
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Removes a domain whole: its capabilities, terms, domain services with their services and tests, repositories, and the links they start. Refused while anything outside it references what is in it. */
export function removeDomain(tx: Transaction, input: RemoveDomain): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.id) ?? tx.refuse('missing', `there is no domain ${input.id}`);
  domains.remove(domain);
}

/** Adds a capability to its domain, at a position, with the business outcomes it serves. */
export function addCapability(tx: Transaction, input: AddCapability): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.domain_id) ?? tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { serves = [], ...row } = input;
  domain.capabilities.push({ row, serves: serves });
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Changes a capability's title, position or description, or the business outcomes it serves (the whole list). */
export function changeCapability(tx: Transaction, input: ChangeCapability): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('capability', input.id) ?? tx.refuse('missing', `there is no capability ${input.id}`);
  domain.capabilities = domain.capabilities.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'position', 'description']), serves: input.serves ?? x.serves } : x));
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Removes a capability and the links it starts. Refused while a use case sits under it or anything else references it. */
export function removeCapability(tx: Transaction, input: RemoveCapability): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('capability', input.id) ?? tx.refuse('missing', `there is no capability ${input.id}`);
  domain.capabilities = domain.capabilities.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}

/** Adds a term to its domain's glossary, with what it means there and the terms it builds on. */
export function addTerm(tx: Transaction, input: AddTerm): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.domain_id) ?? tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { builds_on = [], ...row } = input;
  domain.terms.push({ row, buildsOn: builds_on });
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Changes a term's title, meaning or group, or the terms it builds on (the whole list). */
export function changeTerm(tx: Transaction, input: ChangeTerm): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('term', input.id) ?? tx.refuse('missing', `there is no term ${input.id}`);
  domain.terms = domain.terms.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'meaning', 'group_name']), buildsOn: input.builds_on ?? x.buildsOn } : x));
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Removes a term from its domain. Refused while anything references it. */
export function removeTerm(tx: Transaction, input: RemoveTerm): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('term', input.id) ?? tx.refuse('missing', `there is no term ${input.id}`);
  domain.terms = domain.terms.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}

/** Adds a domain service to its domain, with what it must work out. */
export function addDomainService(tx: Transaction, input: AddDomainService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.domain_id) ?? tx.refuse('missing', `there is no domain ${input.domain_id}`);
  domain.domainServices.push(input);
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Changes a domain service's title or statement. */
export function changeDomainService(tx: Transaction, input: ChangeDomainService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service', input.id) ?? tx.refuse('missing', `there is no domain service ${input.id}`);
  domain.domainServices = domain.domainServices.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement']) : x));
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Removes a domain service with its service and tests and the links they start. Refused while a command or query calls it, or anything else references it or them. */
export function removeDomainService(tx: Transaction, input: RemoveDomainService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service', input.id) ?? tx.refuse('missing', `there is no domain service ${input.id}`);
  domain.domainServices = domain.domainServices.filter((x) => x.id !== input.id);
  domain.services = domain.services.filter((x) => x.row.domain_service_id !== input.id);
  domain.domainServiceTests = domain.domainServiceTests.filter((x) => x.row.domain_service_id !== input.id);
  domains.save(domain);
}

/** Adds a repository to its domain, with the aggregate it persists, the data store it is stored in, the standard rules it meets and the packages it uses. */
export function addRepository(tx: Transaction, input: AddRepository): void {
  const domains = new DomainRepository(tx);
  const domain = domains.load(input.domain_id) ?? tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { persists, stored_in, meets = [], packages = [], ...row } = input;
  domain.repositories.push({ row, meets: meets, packages: packages, persists: persists ?? null, storedIn: stored_in ?? null });
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Changes a repository's title, file or description, the aggregate it persists or the data store it is stored in (null clears either), or the standard rules it meets or packages it uses (each the whole list). */
export function changeRepository(tx: Transaction, input: ChangeRepository): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('repository', input.id) ?? tx.refuse('missing', `there is no repository ${input.id}`);
  domain.repositories = domain.repositories.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'file', 'description']), meets: input.meets ?? x.meets, packages: input.packages ?? x.packages, persists: input.persists === undefined ? x.persists : input.persists, storedIn: input.stored_in === undefined ? x.storedIn : input.stored_in } : x));
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Removes a repository with the links it starts and the packages it uses. Refused while anything references it. */
export function removeRepository(tx: Transaction, input: RemoveRepository): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('repository', input.id) ?? tx.refuse('missing', `there is no repository ${input.id}`);
  domain.repositories = domain.repositories.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}

/** Adds the service that implements a domain service in code, with the standard rules it meets and the packages it uses. */
export function addService(tx: Transaction, input: AddService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service', input.domain_service_id) ?? tx.refuse('missing', `there is no domain service ${input.domain_service_id}`);
  const { meets = [], packages = [], ...row } = input;
  domain.services.push({ row, meets: meets, packages: packages });
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Changes a service's title or file, or the standard rules it meets or packages it uses (each the whole list). */
export function changeService(tx: Transaction, input: ChangeService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('service', input.id) ?? tx.refuse('missing', `there is no service ${input.id}`);
  domain.services = domain.services.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'file']), meets: input.meets ?? x.meets, packages: input.packages ?? x.packages } : x));
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Removes a service with the links it starts and the packages it uses. Refused while anything references it. */
export function removeService(tx: Transaction, input: RemoveService): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('service', input.id) ?? tx.refuse('missing', `there is no service ${input.id}`);
  domain.services = domain.services.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}

/** Adds a domain service test under its domain service, with the test data sets it starts from. */
export function addDomainServiceTest(tx: Transaction, input: AddDomainServiceTest): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service', input.domain_service_id) ?? tx.refuse('missing', `there is no domain service ${input.domain_service_id}`);
  const { starts_from = [], ...row } = input;
  domain.domainServiceTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Changes a domain service test's way of running or the test data sets it starts from (the whole list). */
export function changeDomainServiceTest(tx: Transaction, input: ChangeDomainServiceTest): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service_test', input.id) ?? tx.refuse('missing', `there is no domain service test ${input.id}`);
  domain.domainServiceTests = domain.domainServiceTests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  holdToRules(tx, domain);
  domains.save(domain);
}

/** Removes a domain service test and the links it starts. Refused while anything references it. */
export function removeDomainServiceTest(tx: Transaction, input: RemoveDomainServiceTest): void {
  const domains = new DomainRepository(tx);
  const domain = domains.loadHolding('domain_service_test', input.id) ?? tx.refuse('missing', `there is no domain service test ${input.id}`);
  domain.domainServiceTests = domain.domainServiceTests.filter((x) => x.row.id !== input.id);
  domains.save(domain);
}
