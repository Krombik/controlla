import { EMPTY_ARR } from '#internal/constants';
import type {
  ControlInternals,
  ControlInternalsChild,
  Notifier,
} from '#internal/types';

function get(this: ControlInternalsChild) {
  const path = this._path;

  let value = this._root._value;

  for (let i = 0; i < path!.length; i++) {
    if (value == null) {
      return undefined;
    }

    value = value[path![i]];
  }

  return value;
}

const makeChildNode = (
  root: ControlInternals,
  path: readonly string[],
  children: Map<string, any> | undefined,
  dependents: Notifier[] | typeof EMPTY_ARR
): ControlInternalsChild => ({
  _get: get,
  _listeners: EMPTY_ARR,
  _indexMap: undefined,
  _dependents: dependents,
  _path: path,
  _root: root,
  _children: children,
  _storage: undefined,
  _data: undefined,
});

export default makeChildNode;
