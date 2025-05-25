import type { InternalState } from '../../types';
import { addToBatch } from '../batching';

export function set(this: InternalState, value: any) {
  const self = this;

  if (self._value !== value) {
    self._value = value;

    addToBatch(self, value);
  }
}

export function get(this: InternalState) {
  return this._value;
}
