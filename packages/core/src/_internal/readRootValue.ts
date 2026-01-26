import type { RootControlNode } from '#internal/types';

function readRootValue(this: RootControlNode) {
  return this._value;
}

export default readRootValue;
