import type { ReadonlyAsyncControl, Control } from '#types';
import { INTERNALS } from '#internal/constants';

/**
 * Returns the error control of the given async {@link control} — its value is
 * the current error, or `undefined` while there is none. Usable like
 * any control (`useValue`, `watchValue`, Consumer components).
 */
const selectError = <E>(
  control: ReadonlyAsyncControl<any, E>
): Control<E | undefined> => control[INTERNALS]._root._errorControl as any;

export default selectError;
