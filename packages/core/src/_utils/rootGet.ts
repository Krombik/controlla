import type { ControlRoot } from '#_types';

function rootGet(this: ControlRoot) {
  return this._value;
}

export default rootGet;
