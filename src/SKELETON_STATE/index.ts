import noop from 'lodash.noop';
import { ControllableLoadableNestedState, StateInternalUtils } from '../types';
import alwaysFalse from '../utils/alwaysFalse';

const alwaysNoop = () => noop;

const utils: StateInternalUtils = {
  _value: undefined,
  _get: noop,
  _set: noop,
  _onValueChange: alwaysNoop,
};

const SKELETON_STATE = {
  _internal: utils as any,
  path() {
    return this;
  },
  load: alwaysNoop,
  pause: noop,
  reset: noop,
  resume: noop,
  error: { _internal: utils } as Partial<
    ControllableLoadableNestedState<any>['error']
  > as ControllableLoadableNestedState<any>['error'],
  isLoaded: {
    _internal: {
      _value: undefined,
      _get: alwaysFalse,
      _set: noop,
      _onValueChange: alwaysNoop,
    },
  } as Partial<
    ControllableLoadableNestedState<any>['isLoaded']
  > as ControllableLoadableNestedState<any>['isLoaded'],
} as Partial<
  ControllableLoadableNestedState<any>
> as ControllableLoadableNestedState<any>;

export default SKELETON_STATE;
