// Remember the page in its space (LA-EXP-CMD02): the page becomes its space's last page, and its space the one last chosen.
import { holdToRules } from '../rules';
import { spaceRepository } from '../repository';

export interface RememberPageInSpace {
  /** The product whose space the page belongs to. */
  product: string;
  /** The page, path and query, without the tools open over it. */
  address: string;
}

/** Makes the page its space's last page and the space the one last chosen. */
export function rememberPageInSpace(input: RememberPageInSpace): void {
  const memory = spaceRepository.load();
  if (memory.chosen === input.product && memory.pages[input.product] === input.address) return;
  const next = { ...memory, chosen: input.product, pages: memory.pages[input.product] === input.address ? memory.pages : { ...memory.pages, [input.product]: input.address } };
  holdToRules(next);
  spaceRepository.save(next);
}
