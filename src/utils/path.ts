import { BasePath } from '../types';

function path<T extends BasePath>(this: T, ...path: any[]): T {
  const prevPath = this.p;

  return path.length
    ? { ...this, p: prevPath.length ? prevPath.concat(...path) : path }
    : this;
}

export default path;
