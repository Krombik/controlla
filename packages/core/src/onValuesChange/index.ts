import noop from 'lodash.noop';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import type { Lane, Notifier } from '#internal/types';
import { INTERNALS } from '#shared-internal/constants';
import { EMPTY_ARR } from '#internal/constants';
import attachNotifier from '#internal/attachNotifier';
import addToQueue from '#internal/addToQueue';
import removeFromArray from '#internal/removeFromArray';

type Subscription = {
  _level: number;
  _onChange: (values?: any[], prevValues?: any[]) => void;
  /** `undefined` if the callback takes no arguments */
  readonly _values: any[] | undefined;
  /** `false` if previous values aren't tracked, `undefined` between flushes */
  _prevValues: any[] | false | undefined;
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
  const prevValues = this._prevValues;

  if (prevValues !== false) {
    this._prevValues = undefined;
  }

  this._onChange(this._values, prevValues || undefined);
}

const onValuesChange = ((
  controls: ReadonlyControl[],
  onChange: (values?: any[], prevValues?: any[]) => void
): (() => void) => {
  const count = controls.length;

  const callbackArity = onChange.length;

  const notifiers: Notifier[] = Array(count);

  const values = callbackArity ? Array(count) : undefined;

  const sub: Subscription = {
    _level: 0,
    _onChange: onChange,
    _values: values,
    _prevValues: callbackArity > 1 ? undefined : false,
    _commitSet: commitSet,
  };

  const weakRef = new WeakRef(sub);

  const notify = values ? valuesNotify : plainNotify;

  let maxLevel = 0;

  for (let i = 0; i < count; i++) {
    const internals = controls[i][INTERNALS];

    const root = internals._root;

    if (root._level > maxLevel) {
      maxLevel = root._level;
    }

    if (values) {
      values[i] = internals._get();
    }

    attachNotifier(
      internals,
      (notifiers[i] = {
        _ref: weakRef,
        _notify: notify,
        _index: i,
        _current: EMPTY_ARR,
      })
    );
  }

  sub._level = maxLevel + 1;

  return () => {
    sub._onChange = noop;

    for (let i = 0; i < count; i++) {
      const notifier = notifiers[i];

      removeFromArray(notifier._current!, notifier);
    }
  };
}) as {
  /**
   * Registers a callback to be invoked when the values of multiple {@link controls} change.
   * Changes committed in the same flush are batched into a single call, which is
   * invoked after all monitored controls have settled.
   *
   * @param controls - The controls to monitor for changes.
   * @param onChange - The callback function invoked with the new values of the controls.
   * @returns a function to unsubscribe from the values change event.
   */
  <const S extends ReadonlyControl[]>(
    controls: S,
    onChange: (
      values: {
        [index in keyof S]: S[index] extends ReadonlyControl<infer K>
          ? K | (S[index] extends ReadonlyAsyncControl ? undefined : never)
          : never;
      },
      prevValues: {
        [index in keyof S]: S[index] extends ReadonlyControl<infer K>
          ? K | (S[index] extends ReadonlyAsyncControl ? undefined : never)
          : never;
      }
    ) => void
  ): () => void;
};

export default onValuesChange;
