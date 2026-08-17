import createPrimitiveControl from '#core/createPrimitiveControl';
import scheduleSet from '#internal/scheduleSet';
import { INTERNALS } from '#internal/constants';
import type { Control, ReadonlyControl } from '#types';

const isVisible = () => document.visibilityState === 'visible';

const $pageVisible: Control<boolean> = createPrimitiveControl(
  typeof document !== 'undefined' ? isVisible() : true
);

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    // the tab being looked at or not is nobody's write
    scheduleSet($pageVisible[INTERNALS]._root, isVisible(), true);
  });
}

/** Boolean control tracking page visibility (`document.visibilityState === 'visible'`). */
export default $pageVisible as ReadonlyControl<boolean>;
