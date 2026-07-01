import type { ChangeListener } from '#internal/types';
import { INTERNALS } from '#internal/constants';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import noop from 'lodash.noop';

const watchValue: {
  /**
   * Runs the {@link callback} with the new and previous value whenever the
   * given {@link control}'s value changes. Pass {@link immediate} to also run
   * it right away with the current value (previous value `undefined`). A plain
   * listener — it doesn't trigger loading of a loadable control.
   *
   * The callback may return a cleanup function, run before the next call and
   * on unsubscribe.
   *
   * @returns a function to remove the callback.
   *
   * @example
   * ```ts
   * const unsubscribe = watchValue($roomId, (roomId) => {
   *   const socket = openRoom(roomId);
   *
   *   return () => socket.close();
   * }, true);
   * ```
   */
  <T>(
    control: ReadonlyAsyncControl<T>,
    callback: (
      value: T | undefined,
      prevValue: T | undefined
    ) => void | (() => void),
    immediate?: boolean
  ): () => void;
  /**
   * Runs the {@link callback} with the new and previous value whenever the
   * given {@link control}'s value changes. Pass {@link immediate} to also run
   * it right away with the current value (previous value `undefined`).
   *
   * The callback may return a cleanup function, run before the next call and
   * on unsubscribe.
   *
   * @returns a function to remove the callback.
   */
  <T, I extends boolean = false>(
    control: ReadonlyControl<T>,
    callback: (
      value: T,
      prevValue: T | (I extends true ? undefined : never)
    ) => void | (() => void),
    immediate?: I
  ): () => void;
} = (
  control: ReadonlyControl,
  callback: (value: any, prevValue: any) => void | (() => void),
  immediate?: boolean
) => {
  const internals = control[INTERNALS];

  const root = internals._root;

  const effect: ChangeListener = (value, prevValue) => {
    cleanup();

    cleanup = callback(value, prevValue) || noop;
  };

  let cleanup: () => void =
    (immediate && callback(internals._get(), undefined)) || noop;

  root._attach(internals, effect, false);

  return () => {
    root._detach(internals, effect, false);

    cleanup();

    cleanup = noop;
  };
};

export default watchValue;
