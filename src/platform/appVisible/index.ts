import createPrimitiveControl from '#core/createPrimitiveControl';
import scheduleSet from '#internal/scheduleSet';
import { INTERNALS } from '#internal/constants';
import type { Control, ReadonlyControl } from '#types';

const isVisible = () => document.visibilityState === 'visible';

const $appVisible: Control<boolean> = createPrimitiveControl(
  typeof document !== 'undefined' ? isVisible() : true
);

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    // the tab being looked at or not is nobody's write
    scheduleSet($appVisible[INTERNALS]._root, isVisible(), true);
  });
}

/**
 * Boolean control tracking whether the app is in front of the user - on the
 * web, `document.visibilityState === 'visible'`.
 */
export default $appVisible as ReadonlyControl<boolean>;
