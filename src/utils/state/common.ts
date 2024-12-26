import type { InternalSetData, State, ValueChangeCallbacks } from '../../types';
import { addToBatch } from '../batching';

type CommonState = State & InternalSetData<ValueChangeCallbacks>;

export function _onValueChange(this: CommonState, cb: (value: any) => void) {
  const set = this._setData;

  set.add(cb);

  return () => {
    set.delete(cb);
  };
}

export function set(this: CommonState, value: any) {
  const self = this;

  if (self._value !== value) {
    self._value = value;

    addToBatch(this._setData, value);
  }
}

export function get(this: CommonState) {
  return this._value;
}
