/** @internal */
const concat = <T>(arr: Array<T> | ReadonlyArray<T>, item: T) => {
  const l = arr.length;

  const out = Array<T>(l + 1);

  for (let i = 0; i < l; i++) {
    out[i] = arr[i];
  }

  out[l] = item;

  return out;
};

/** @internal */
export default concat;
