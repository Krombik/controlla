import type { Key, PathBase } from '../types';

function path<T extends PathBase<any>>(this: T, ...path: Key[]): any {
  const prevPath = this._path!;

  return path.length
    ? ({ ...this, _path: prevPath.length ? prevPath.concat(path) : path } as T)
    : this;
}

export default path;
