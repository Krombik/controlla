const concat = <T>(arr: Array<T> | ReadonlyArray<T>, item: T) => {
  const l = arr.length;

  const path = Array<T>(l + 1);

  for (let i = 0; i < l; i++) {
    path[i] = arr[i];
  }

  path[l] = item;

  return path as Array<T>;
};

export default concat;
