import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { INTERNALS } from '#internal/constants';

/**
 * Returns the loading control of the given async {@link control} — its value
 * is `true` while the control is loading. Usable like any control
 * (`useValue`, `onValueChange`, Consumer components).
 */
const selectLoading = (
  control: ReadonlyAsyncControl
): ReadonlyControl<boolean> => control[INTERNALS]._root._loadingControl as any;

export default selectLoading;
