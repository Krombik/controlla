import type { ChangeListener } from '#internal/types';
import { INTERNALS } from '#internal/constants';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import noop from '#internal/noop';
import reportError from '#internal/reportError';

const watchValue: {
  /**
   * Runs the {@link callback} with the new and previous value whenever the
   * given {@link control}'s value changes. Pass {@link immediate} to also run
   * it right away with the current value (previous value `undefined`). A plain
   * listener — it doesn't trigger loading of a loadable control.
   *
   * The callback may return a cleanup function, run before the next call and
   * on unwatch.
   *
   * @returns a function to stop watching.
   *
   * @example
   * ```ts
   * const unwatch = watchValue($theme, (theme, prevTheme) => {
   *   console.log(`theme: ${prevTheme} -> ${theme}`);
   * });
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
   * on unwatch.
   *
   * @returns a function to stop watching.
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
    try {
      cleanup();
    } catch (err) {
      reportError(err);
    }

    try {
      cleanup = callback(value, prevValue) || noop;
    } catch (err) {
      reportError(err);

      cleanup = noop;
    }
  };

  let cleanup: () => void = noop;

  if (immediate) {
    try {
      cleanup = callback(internals._get(), undefined) || noop;
    } catch (err) {
      reportError(err);
    }
  }

  root._attach(internals, effect, false);

  return () => {
    root._detach(internals, effect, false);

    try {
      cleanup();
    } catch (err) {
      reportError(err);
    }

    cleanup = callback = noop;
  };
};

export default watchValue;
