import { refuseBroken } from '../../shell/prefs';
import { isSpacePage, type SpaceMemory } from './model';

// The Space aggregate's rules, held by every command before it saves.

/** Every problem with the spaces as kept: a space's last page is a page of a space (LA-EXP-INV20). */
export function spaceProblems(memory: SpaceMemory): string[] {
  return Object.entries(memory.pages)
    .filter(([, page]) => !isSpacePage(page))
    .map(([space, page]) => `The last page of space ${space}, ${page}, is not a page of a space.`);
}

/** Refuses the spaces with every problem they have. */
export function holdToRules(memory: SpaceMemory): void {
  refuseBroken(spaceProblems(memory));
}
