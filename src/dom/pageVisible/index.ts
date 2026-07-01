import createPrimitiveControl from '#core/createPrimitiveControl';
import setValue from '#core/setValue';
import type { Control, ReadonlyControl } from '#types';

const isVisible = () => document.visibilityState === 'visible';

const $pageVisible: Control<boolean> = createPrimitiveControl(
  typeof document !== 'undefined' ? isVisible() : true
);

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    setValue($pageVisible, isVisible());
  });
}

/** Boolean control tracking page visibility (`document.visibilityState === 'visible'`). */
export default $pageVisible as ReadonlyControl<boolean>;
