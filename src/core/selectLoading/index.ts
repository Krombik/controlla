import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { INTERNALS } from '#internal/constants';

/**
 * Returns the loading control of the given async {@link control} — a boolean,
 * `true` while a load is in flight, `false` otherwise (can be `true` alongside
 * a ready value during a background reload). Usable like any control
 * (`useValue`, `watchValue`, Consumer components).
 */
const selectLoading = (
  control: ReadonlyAsyncControl
): ReadonlyControl<boolean> => control[INTERNALS]._root._loadingControl as any;

export default selectLoading;
