import type { State } from '../../types';
import { addToBatch } from '../batching';

export function set(this: State, value: any) {
  const self = this;

  if (self._value !== value) {
    self._value = value;

    addToBatch(self, value);
  }
}

export function get(this: State) {
  return this._value;
}
