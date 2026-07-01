import type {
  ControlInternals,
  Lane,
  PrimitiveControlInternals,
} from '#internal/types';
import readRootValue from '#internal/readRootValue';
import { EMPTY_ARR } from '#internal/constants';
import notify from '#internal/notify';
import addToLevel from '#internal/addToLevel';
import { attach, detach } from '#internal/syncLifecycle';

function enqueueSet(this: ControlInternals, value: any, lane: Lane) {
  const patchByControl = lane._patchByControl;

  if (!patchByControl.has(this)) {
    addToLevel(lane, this);
  }

  patchByControl.set(this, value);
}

function commitSet(this: ControlInternals, nextValue: any, lane: Lane) {
  const root = this;

  const prevValue = root._value;

  if (nextValue !== prevValue) {
    root._value = nextValue;

    notify(root._listeners, root._dependents, lane, nextValue, prevValue);

    if (root._externalStorage) {
      root._externalStorage.set(nextValue);
    }
  }
}

/** Creates ready-to-use primitive control internals holding the given value. */
const makePrimitiveInternals = (value: any): PrimitiveControlInternals => {
  const internals: PrimitiveControlInternals = {
    _root: undefined!,
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
    _externalStorage: undefined,
  };

  (internals as { _root: PrimitiveControlInternals })._root = internals;

  return internals;
};

export default makePrimitiveInternals;
