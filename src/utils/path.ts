import type { InternalPathBase, PathKey, StatePath } from '../types';

function path<T extends StatePath<any> & InternalPathBase>(
  this: T,
  ...path: PathKey[]
): any {
  const prevPath = this._path!;

  return path.length
    ? ({ ...this, _path: prevPath.length ? prevPath.concat(path) : path } as T)
    : this;
}

export default path;
