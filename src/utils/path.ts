import type { BasePath } from '../types';

function path<T extends BasePath>(this: T, ...path: any[]): T {
  const prevPath = this._p;

  return path.length
    ? { ...this, _p: prevPath.length ? prevPath.concat(...path) : path }
    : this;
}

export default path;
