import noop from '#internal/noop';
import type { ReadonlyControl, SelectValue } from '#types';
import type {
  AsyncControlInternals,
  ControlInternals,
  Lane,
  Notifier,
} from '#internal/types';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import attachNotifier from '#internal/attachNotifier';
import addToQueue from '#internal/addToQueue';
import removeFromArray from '#internal/removeFromArray';
import reportError from '#internal/reportError';
import { sourceUpdate } from '#internal/sourceUpdate';

const enum Status {
  NONE,
  /** The tuple they first hold together is where the watch starts, not a change. */
  FIRST,
  /** The same tuple, which an immediate watch has been waiting for. */
  IMMEDIATE,
}

type Watch = {
  _level: number;
  _callback(values?: any[], prevValues?: any[]): void | (() => void);
  readonly _values: any[] | undefined;
  _prevValues: any[] | false;
  /**
   * The loadable roots behind them, deduped. Emptiness is theirs to answer and
   * not the values': one of `undefined` under a loaded root is a value.
   */
  _loadable: ControlInternals[] | undefined;
  _status: Status;
  /** Any one of them moving on its own makes the tuple the source's. */
  _fromSource: boolean;
  _cleanup(): void;
  _commitSet(data: null, lane: Lane): void;
};

function valuesNotify(this: Notifier, lane: Lane, value: any) {
  const sub: Watch = this._target;

  sub._values![this._index] = value;

  sub._fromSource ||= sourceUpdate._value;

  addToQueue(lane, sub as any);
}

function plainNotify(this: Notifier, lane: Lane) {
  const sub: Watch = this._target;

  sub._fromSource ||= sourceUpdate._value;

  addToQueue(lane, sub as any);
}

const keepTuple = (sub: Watch) => {
  if (sub._prevValues !== false) {
    sub._prevValues = sub._values!.slice();
  }
};

function commitSet(this: Watch) {
  const self = this;

  const loadable = self._loadable;

  // a tuple with a hole in it isn't what the callback is typed for, so the whole
  // flush waits - whatever moved in it sits in `_values` for the one that does.
  // Asked here rather than per notification: within a flush a load landing and a
  // change to something else arrive in either order, and neither decides what
  // the other means
  if (loadable !== undefined) {
    for (let i = loadable.length; i--;) {
      if (loadable[i]._value === undefined) {
        return;
      }
    }
  }

  const values = self._values;

  const prevValues = self._prevValues;

  const fromSource = self._fromSource;

  self._fromSource = false;

  keepTuple(self);

  if (self._status) {
    const isFirst = self._status == Status.FIRST;

    self._status = Status.NONE;

    if (isFirst) {
      return;
    }
  }

  try {
    self._cleanup();
  } catch (err) {
    reportError(err);
  }

  // the tuple is handed over a level after whatever moved it, so what that was
  // is put back here
  sourceUpdate._value = fromSource;

  try {
    self._cleanup = self._callback(values, prevValues || undefined) || noop;
  } catch (err) {
    reportError(err);

    self._cleanup = noop;
  }

  sourceUpdate._value = false;
}

const watchValues = ((
  controls: ReadonlyControl[],
  callback: (values?: any[], prevValues?: any[]) => void | (() => void),
  immediate?: boolean,
  withEmpty?: boolean
): (() => void) => {
  const count = controls.length;

  const callbackArity = callback.length;

  const notifiers: Notifier[] = Array(count);

  const values = callbackArity ? Array(count) : undefined;

  const sub: Watch = {
    _level: 0,
    _callback: callback,
    _values: values,
    _prevValues: callbackArity > 1 ? Array(count) : false,
    _loadable: undefined,
    _status: Status.NONE,
    _fromSource: false,
    _cleanup: noop,
    _commitSet: commitSet,
  };

  const notify = callbackArity ? valuesNotify : plainNotify;

  let maxLevel = 0;

  for (let i = 0; i < count; i++) {
    const internals = controls[i][INTERNALS];

    const root = internals._root;

    if (root._level > maxLevel) {
      maxLevel = root._level;
    }

    root._attach(internals, undefined, false);

    if (callbackArity) {
      values![i] = internals._get();
    }

    // a bound control carries the key with nothing in it while its target isn't
    // async, so what's there is what says so - except for the loading control,
    // which is what says there is nothing and so never holds nothing itself
    if (
      !withEmpty &&
      (root as Partial<AsyncControlInternals>)._errorControl &&
      internals !==
        (root as AsyncControlInternals)._loadingControl[INTERNALS] &&
      (sub._loadable ||= []).indexOf(root) < 0
    ) {
      sub._loadable.push(root);

      if (root._value === undefined && !sub._status) {
        sub._status = immediate ? Status.IMMEDIATE : Status.FIRST;

        immediate = false;
      }
    }

    attachNotifier(
      internals,
      (notifiers[i] = {
        _target: sub,
        _notify: notify,
        _index: i,
        _attachedTo: EMPTY_ARR,
        _source: undefined,
      })
    );
  }

  sub._level = maxLevel + 1;

  if (immediate) {
    try {
      sub._cleanup = callback(values, sub._prevValues || undefined) || noop;
    } catch (err) {
      reportError(err);
    }
  }

  // what they hold now is what the first change is a change from
  keepTuple(sub);

  return () => {
    sub._callback = noop;

    for (let i = 0; i < count; i++) {
      const notifier = notifiers[i];

      removeFromArray(notifier._attachedTo!, notifier);

      notifier._source = undefined;
    }

    try {
      sub._cleanup();
    } catch (err) {
      reportError(err);
    }

    sub._cleanup = noop;
  };
}) as {
  /**
   * The same, reporting the stretches where one of them holds no value as well
   * — the load it opens with, and every `invalidate` after. Its place in both
   * tuples comes as `undefined` for those.
   */
  <const S extends ReadonlyControl[]>(
    controls: S,
    callback: (
      values: { [index in keyof S]: SelectValue<S[index]> | undefined },
      prevValues: { [index in keyof S]: SelectValue<S[index]> | undefined }
    ) => void | (() => void),
    immediate: boolean,
    withEmpty: true
  ): () => void;
  /**
   * Runs the {@link callback} with the new and previous values whenever any of
   * the {@link controls} changes, until the returned function is called;
   * changes committed in the same flush produce a single call. A plain
   * listener — it doesn't trigger loading.
   *
   * Only full tuples count. Nothing is reported while any of them holds no
   * value — whatever moved meanwhile is kept and goes out with the rest, and
   * what follows an `invalidate` is a change from the last tuple handed over.
   * Pass {@link immediate} for one call with the values they already hold, or
   * with their first once they all have one.
   *
   * The callback may return a cleanup function, run before the next call and
   * on unwatch.
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
      values: { [index in keyof S]: SelectValue<S[index]> },
      prevValues: {
        [index in keyof S]:
          SelectValue<S[index]> | (I extends true ? undefined : never);
      }
    ) => void | (() => void),
    immediate?: I
  ): () => void;
};

export default watchValues;
