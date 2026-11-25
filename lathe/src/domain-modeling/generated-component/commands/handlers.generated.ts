// Generated from data/ by `npm run generate`. Do not edit.
// The generated-component commands whose handler is the pattern: load the generated component, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { GeneratedComponentRepository } from '../repository.ts';
import type { AddGeneratedComponent } from './add-generated-component.ts';
import type { ChangeGeneratedComponent } from './change-generated-component.ts';
import type { RemoveGeneratedComponent } from './remove-generated-component.ts';

/** Adds a generated component to a business domain: what the product emits for code outside the repo, with the business outcomes it serves. */
export function addGeneratedComponent(tx: Transaction, input: AddGeneratedComponent): void {
  const generatedComponents = new GeneratedComponentRepository(tx);
  if (tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { serves = [], ...row } = input;
  const generatedComponent = generatedComponents.create({ root: row.id, generatedComponent: row, serves: serves });
  generatedComponents.save(generatedComponent);
}

/** Changes a generated component's title or description, or the business outcomes it serves (the whole list). Its domain never changes. */
export function changeGeneratedComponent(tx: Transaction, input: ChangeGeneratedComponent): void {
  const generatedComponents = new GeneratedComponentRepository(tx);
  const generatedComponent = generatedComponents.load(input.id) ?? tx.refuse('missing', `there is no generated component ${input.id}`);
  generatedComponent.generatedComponent = changed(generatedComponent.generatedComponent, input, ['title', 'description']);
  generatedComponent.serves = input.serves ?? generatedComponent.serves;
  generatedComponents.save(generatedComponent);
}

/** Removes a generated component and the links it starts. Refused while anything references it, such as a guarantee it makes or a pattern whose fixed part it makes. */
export function removeGeneratedComponent(tx: Transaction, input: RemoveGeneratedComponent): void {
  const generatedComponents = new GeneratedComponentRepository(tx);
  const generatedComponent = generatedComponents.load(input.id) ?? tx.refuse('missing', `there is no generated component ${input.id}`);
  generatedComponents.remove(generatedComponent);
}
