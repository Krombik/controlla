import type { InternalPathBase, StateScope } from '../types';
import { end$ } from './constants';

function scope<T extends StateScope<any> & InternalPathBase>(this: T): any {
  const self = this;

  const prevPath = self._path!;

  const path = prevPath.length ? prevPath.slice() : [];

  const proxy = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop == end$) {
          return { ...self, _path: path } as T;
        }

        path.push(prop as string);

        return proxy;
      },
    }
  );

  return proxy;
}

export default scope;
