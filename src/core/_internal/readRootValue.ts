import type { RootBase } from '#internal/types';

function readRootValue(this: RootBase) {
  return this._value;
}

export default readRootValue;
