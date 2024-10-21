import noop from 'lodash.noop';
import {
  ControllableLoadableNestedState,
  StateInternalUtils,
  StateScope,
} from '../types';
import alwaysFalse from '../utils/alwaysFalse';
import { end$ } from '../utils/constants';

const alwaysNoop = () => noop;

const utils: StateInternalUtils = {
  _value: undefined,
  _get: noop,
  _set: noop,
  _onValueChange: alwaysNoop,
};

type Scope = StateScope<() => any>;

type SkeletonState = Omit<
  ControllableLoadableNestedState<any, any, any[]>,
  keyof Scope
> &
  Scope;

const SKELETON_STATE = {
  _internal: utils as any,
  scope() {
    const self = this;

    const proxy = new Proxy(
      {},
      {
        get(_, prop) {
          return prop != end$ ? proxy : self;
        },
      }
    );

    return proxy;
  },
  load: alwaysNoop,
  pause: noop,
  reset: noop,
  resume: noop,
  error: { _internal: utils } as Partial<
    ControllableLoadableNestedState['error']
  > as ControllableLoadableNestedState['error'],
  isLoaded: {
    _internal: {
      _value: undefined,
      _get: alwaysFalse,
      _set: noop,
      _onValueChange: alwaysNoop,
    },
  } as Partial<
    ControllableLoadableNestedState['isLoaded']
  > as ControllableLoadableNestedState['isLoaded'],
} as Partial<ControllableLoadableNestedState> as SkeletonState;

export default SKELETON_STATE;
