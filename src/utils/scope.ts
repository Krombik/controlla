import type { InternalPathBase } from '../types';
import concat from './concat';
import { $tate } from './constants';

function scope(this: InternalPathBase): any {
  const self = this;

  const handler: ProxyHandler<readonly string[]> = {
    get: (path, prop) =>
      prop != $tate
        ? new Proxy(concat(path, prop), handler)
        : Object.create(self, { _path: { value: path } }),
  };

  return new Proxy(self._path!, handler);
}

export default scope;
