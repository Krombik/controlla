import type { InternalControl } from '#_types';
import { addToBatch } from '#shared/batching';

export function set(this: InternalControl, value: any) {
  const self = this;

  if (self._value !== value) {
    self._value = value;

    addToBatch(self, value);
  }
}

export function get(this: InternalControl) {
  return this._value;
}
