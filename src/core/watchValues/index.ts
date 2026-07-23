import noop from '#internal/noop';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import type { Lane, Notifier } from '#internal/types';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import attachNotifier from '#internal/attachNotifier';
import addToQueue from '#internal/addToQueue';
import removeFromArray from '#internal/removeFromArray';

type Subscription = {
  _level: number;
  _callback(values?: any[], prevValues?: any[]): void | (() => void);
  /** `undefined` when the callback takes no arguments */
  readonly _values: any[] | undefined;
  /** `false`: not tracked (callback arity < 2); `undefined`: nothing changed since last flush */
  _prevValues: any[] | false | undefined;
  _cleanup(): void;
  _commitSet(data: null, lane: Lane): void;
};

function valuesNotify(
  this: Notifier,
  lane: Lane,
  sub: Subscription,
  value: any
) {
  const values = sub._values!;

  if (sub._prevValues === undefined) {
    sub._prevValues = values.slice();
  }

  values[this._index] = value;

  addToQueue(lane, sub as any);
}

function plainNotify(this: Notifier, lane: Lane, sub: Subscription) {
  addToQueue(lane, sub as any);
}

function commitSet(this: Subscription) {
  const self = this;

  const prevValues = self._prevValues;

  if (prevValues !== false) {
    self._prevValues = undefined;
  }

  self._cleanup();

  self._cleanup = self._callback(self._values, prevValues || undefined) || noop;
}

const watchValues = ((
  controls: ReadonlyControl[],
  callback: (values?: any[], prevValues?: any[]) => void | (() => void),
  immediate?: boolean
): (() => void) => {
  const count = controls.length;

  const callbackArity = callback.length;

  const notifiers: Notifier[] = Array(count);

  const values = callbackArity ? Array(count) : undefined;

  const sub: Subscription = {
    _level: 0,
    _callback: callback,
    _values: values,
    _prevValues: callbackArity > 1 ? undefined : false,
    _cleanup: noop,
    _commitSet: commitSet,
  };

  const weakRef = new WeakRef(sub);

  const notify = callbackArity ? valuesNotify : plainNotify;

  let maxLevel = 0;

  for (let i = 0; i < count; i++) {
    const internals = controls[i][INTERNALS];

    const root = internals._root;

    if (root._level > maxLevel) {
      maxLevel = root._level;
    }

    if (callbackArity) {
      values![i] = internals._get();
    }

    attachNotifier(
      internals,
      (notifiers[i] = {
        _ref: weakRef,
        _notify: notify,
        _index: i,
        _attachedTo: EMPTY_ARR,
      })
    );
  }

  sub._level = maxLevel + 1;

  if (immediate) {
    sub._cleanup =
      callback(values, callbackArity > 1 ? Array(count) : undefined) || noop;
  }

  return () => {
    sub._callback = noop;

    for (let i = 0; i < count; i++) {
      const notifier = notifiers[i];

      removeFromArray(notifier._attachedTo!, notifier);
    }

    sub._cleanup();

    sub._cleanup = noop;
  };
}) as {
  /**
   * Runs the {@link callback} with the new and previous values whenever any of
   * the {@link controls} change; changes committed in the same flush produce a
   * single call. Pass {@link immediate} to also run it right away with the
   * current values (previous values all `undefined`). A plain listener — it
   * doesn't trigger loading.
   *
   * The callback may return a cleanup function, run before the next call and
   * on unwatch.
   *
   * @returns a function to stop watching.
   *
   * @example
   * ```ts
   * const unwatch = watchValues([$query, $page], ([query, page]) => {
   *   console.log(`search: "${query}", page ${page}`);
   * });
   * ```
   */
  <const S extends ReadonlyControl[], I extends boolean = false>(
    controls: S,
    callback: (
      values: {
        [index in keyof S]: S[index] extends ReadonlyControl<infer K>
          ? K | (S[index] extends ReadonlyAsyncControl ? undefined : never)
          : never;
      },
      prevValues: {
        [index in keyof S]: S[index] extends ReadonlyControl<infer K>
          ? | K
            | (I extends false
                ? S[index] extends ReadonlyAsyncControl
                  ? undefined
                  : never
                : undefined)
          : never;
      }
    ) => void | (() => void),
    immediate?: I
  ): () => void;
};

export default watchValues;
