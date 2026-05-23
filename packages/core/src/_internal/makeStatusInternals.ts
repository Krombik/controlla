import { INTERNALS } from '#shared-internal/constants';
import { EMPTY_ARR } from '#internal/constants';
import readRootValue from '#internal/readRootValue';
import type {
  Attachers,
  ControlInternals,
  ReadonlyPrimitiveControlInternals,
} from '#internal/types';

const makeStatusInternals = (
  root: ControlInternals,
  value: any
): Omit<ReadonlyPrimitiveControlInternals, keyof Attachers> => ({
  [INTERNALS]: root,
  _dependents: EMPTY_ARR,
  _get: readRootValue,
  _indexMap: undefined,
  _listeners: EMPTY_ARR,
  _path: undefined,
  _value: value,
});

export default makeStatusInternals;
