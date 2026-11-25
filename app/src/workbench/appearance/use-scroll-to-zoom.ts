import { useAggregate } from '../../shell/prefs';
import { appearanceRepository } from './repository';

/** Whether scroll zooms the stages' cameras (Scroll to zoom), read again after each command changes the Appearance. */
export const useScrollToZoom = (): boolean => useAggregate(appearanceRepository).scrollToZoom;
