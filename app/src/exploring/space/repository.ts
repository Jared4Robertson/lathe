// Generated from data/ by `npm run generate`. Do not edit.
// SpaceRepository (LA-EXP-REPO02): Keeps the spaces as JSON in browser storage: `lathe:space` (local, the space chosen
// last), `lathe:space-pages` (session, each space's last page) and `lathe:space-rail` (local, whether two or more
// spaces were listed last time), loaded and saved whole.
import { BrowserRepository } from '../../shell/prefs';
import { putStored, readStored, storedText } from '../../shell/storage';
import { SPACE_STORAGE, spaceFrom, type SpaceMemory } from './model';

export class SpaceRepository extends BrowserRepository<SpaceMemory> {
  protected stored() {
    return [storedText(SPACE_STORAGE.chosen), storedText(SPACE_STORAGE.pages), storedText(SPACE_STORAGE.several)].join('\n');
  }

  protected read(): SpaceMemory {
    const space = spaceFrom({ chosen: readStored(SPACE_STORAGE.chosen), pages: readStored(SPACE_STORAGE.pages), several: readStored(SPACE_STORAGE.several) });
    this.#put(space, true);
    return space;
  }

  protected write(space: SpaceMemory) {
    this.#put(space, false);
  }

  // Keeps each part whose stored text changed; held, only a part already stored, so one read in another form is
  // rewritten in today's.
  #put(space: SpaceMemory, held: boolean) {
    putStored(SPACE_STORAGE.chosen, space.chosen, held);
    putStored(SPACE_STORAGE.pages, space.pages, held);
    putStored(SPACE_STORAGE.several, space.several, held);
  }
}

export const spaceRepository = new SpaceRepository();
