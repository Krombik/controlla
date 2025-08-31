const prepend = <T>(arr: Array<T> | ReadonlyArray<T>, item: T) => {
  const l = arr.length;

  const out = Array<T>(l + 1);

  out[0] = item;

  for (let i = 0; i < l; i++) {
    out[i + 1] = arr[i];
  }

  return out as Array<T>;
};

export default prepend;
