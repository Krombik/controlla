import type { ReadonlyAsyncControl } from '#types';
import { INTERNALS } from '#internal/constants';
import ensurePromise from '#internal/ensurePromise';

/**
 * Returns a promise reflecting the given async {@link control}: resolved with
 * the value once ready, rejected with the control's error if it failed,
 * otherwise pending until the control settles.
 *
 * Calling it does **not** start loading — the control must be in use or
 * loaded explicitly via `load`. For a nested control the promise settles
 * with its root and resolves to the value at that path.
 *
 * @example
 * ```ts
 * const user = await toPromise($user);
 * ```
 */
const toPromise = <T>(control: ReadonlyAsyncControl<T>): Promise<T> => {
  const internals = control[INTERNALS];

  return internals._path
    ? ensurePromise(internals._root).then(() => internals._get())
    : ensurePromise(internals._root);
};

export default toPromise;
