import type { AsyncControlInternals, ChangeListener } from '#internal/types';
import { INTERNALS } from '#internal/constants';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import noop from '#internal/noop';
import reportError from '#internal/reportError';

const watchValue: {
  /**
   * The same, reporting the stretches where the {@link control} holds no value
   * as well — the load it opens with, and every `invalidate` after. Both
   * arguments come as `undefined` for those.
   */
  <T>(
    control: ReadonlyAsyncControl<T>,
    callback: (
      value: T | undefined,
      prevValue: T | undefined
    ) => void | (() => void),
    immediate: boolean,
    withEmpty: true
  ): () => void;
  /**
   * Runs the {@link callback} with the new and previous value whenever the
   * given {@link control}'s value changes, until the returned function is
   * called. A plain listener — it doesn't trigger loading.
   *
   * Only values count. A loadable control says nothing when its first one
   * arrives, nor while an `invalidate` leaves it with none: what comes back is
   * a change from the last value handed over. Pass {@link immediate} for one
   * call with the value it already has, or with its first when it has none.
   *
   * The callback may return a cleanup function, run before the next call and
   * on unwatch.
   *
   * @example
   * ```ts
   * // what someone edited, not the settings landing from the server
   * const unwatch = watchValue($settings, () => form.submit());
   * ```
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
  immediate?: boolean,
  withEmpty?: boolean
) => {
  const internals = control[INTERNALS];

  const root = internals._root;

  let cleanup: () => void = noop;

  let effect: ChangeListener = (value, prevValue) => {
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

  // a bound control carries the key with nothing in it while its target isn't
  // async, so what's there is what says so
  if (!withEmpty && (root as Partial<AsyncControlInternals>)._errorControl) {
    /** The value it opens with is where it starts rather than a change to it. */
    const skipArrival = !immediate;

    const onChange = effect;

    /** What was handed over last: a gap hides the `undefined` in between. */
    let last = internals._get();

    let pending = root._value === undefined;

    // nothing to be immediate about with no value yet - the arrival runs it
    immediate &&= !pending;

    effect = (value) => {
      // an `invalidate` took it away, and a loaded one never holds `undefined`
      if (root._value === undefined) {
        return;
      }

      const prevValue = last;

      last = value;

      if (pending) {
        pending = false;

        if (skipArrival) {
          return;
        }
      }

      onChange(value, prevValue);
    };
  }

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
