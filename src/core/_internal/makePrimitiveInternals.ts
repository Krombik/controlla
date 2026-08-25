import noop from '#internal/noop';
import type { Lane, Mutable, PrimitiveControlInternals } from '#internal/types';
import readRootValue from '#internal/readRootValue';
import { EMPTY_ARR } from '#internal/constants';
import addToLevel from '#internal/addToLevel';
import { attach, detach } from '#internal/syncLifecycle';
import { notify } from '#internal/flushQueue';
import { sourceUpdate } from '#internal/sourceUpdate';

/** Its patch is the value itself, so the mark rides on the control. */
type MarkedInternals = PrimitiveControlInternals & { _fromSource: boolean };

function enqueueSet(
  this: MarkedInternals,
  value: any,
  lane: Lane,
  fromSource: boolean
) {
  const patchByControl = lane._patchByControl;

  if (!patchByControl.has(this)) {
    addToLevel(lane, this);
  }

  patchByControl.set(this, value);

  this._fromSource = fromSource;
}

function commitSet(this: MarkedInternals, nextValue: any, lane: Lane) {
  const root = this;

  const prevValue = root._value;

  if (nextValue !== prevValue) {
    sourceUpdate._value = root._fromSource;

    root._value = nextValue;

    notify(root, lane, nextValue, prevValue);

    root._setExternal(nextValue);

    sourceUpdate._value = false;
  }
}

const makePrimitiveInternals = (value: any): PrimitiveControlInternals => {
  const internals: MarkedInternals = {
    _root: undefined!,
    _pending: undefined,
    _get: readRootValue,
    _listeners: EMPTY_ARR,
    _indexMap: undefined,
    _dependents: EMPTY_ARR,
    _path: undefined,
    _level: 0,
    _value: value,
    _attach: attach,
    _detach: detach,
    _load: false,
    _commitSet: commitSet,
    _enqueueSet: enqueueSet,
    _setExternal: noop,
    _fromSource: false,
  };

  (internals as Mutable<PrimitiveControlInternals>)._root = internals;

  return internals;
};

export default makePrimitiveInternals;
