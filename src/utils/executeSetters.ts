import { CallbackSet } from '../types';

const executeSetters = (set: CallbackSet, value?: unknown) => {
  const it = set.values();

  const next = it.next.bind(it);

  for (let i = set.size; i--; ) {
    next().value(value);
  }
};

export default executeSetters;
