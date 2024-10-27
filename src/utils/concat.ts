const concat = <T>(arr: Array<T> | ReadonlyArray<T>, item: T) => {
  const l = arr.length;

  const path = new Array<T>(l + 1);

  for (let i = 0; i < l; i++) {
    path[i] = arr[i];
  }

  path[l] = item;

  return path as ReadonlyArray<T>;
};

export default concat;
