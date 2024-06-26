import { Key } from '../types';

const safeGet = (value: any, path: Key[]) => {
  const l = path.length;

  for (
    let i = 0;
    i < l && (value = value ? value[path[i]] : undefined) !== undefined;
    i++
  ) {}

  return value;
};

export default safeGet;
