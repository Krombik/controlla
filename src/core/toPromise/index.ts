import type { ReadonlyAsyncControl } from '#types';
import { INTERNALS } from '#internal/constants';
import armPromise from '#internal/armPromise';

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

  const root = internals._root;

  let promise;

  if (root._promise) {
    promise = root._promise._promise;
  } else if (root._value !== undefined) {
    promise = Promise.resolve(root._value);
  } else {
    const err = root._errorControl[INTERNALS]._value;

    if (err === undefined) {
      promise = armPromise(root);
    } else {
      promise = Promise.reject(err);
    }
  }

  return internals._path ? promise.then(() => internals._get()) : promise;
};

export default toPromise;
