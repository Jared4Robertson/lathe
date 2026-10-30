// Note how many spaces there are (LA-EXP-CMD20): whether two or more spaces were listed, kept so the nav's space rail is drawn where it will stay before the products are read again.
import { holdToRules } from '../rules';
import { spaceRepository } from '../repository';

export interface NoteSpacesListed {
  /** Whether two or more spaces are listed. */
  several: boolean;
}

/** Keeps whether two or more spaces were listed. */
export function noteSpacesListed(input: NoteSpacesListed): void {
  const memory = spaceRepository.load();
  if (memory.several === input.several) return;
  const next = { ...memory, several: input.several };
  holdToRules(next);
  spaceRepository.save(next);
}
