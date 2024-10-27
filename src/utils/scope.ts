import type { InternalPathBase } from '../types';
import { $tate } from './constants';

function scope(this: InternalPathBase): any {
  const self = this;

  return new Proxy(self._path!, {
    get(target, prop) {
      if (prop == $tate) {
        return {
          ...self,
          _path: target,
        };
      }

      const l = target.length;

      const path = new Array(l + 1);

      for (let i = 0; i < l; i++) {
        path[i] = target[i];
      }

      path[l] = prop;

      return new Proxy(path, this);
    },
  });
}

export default scope;
