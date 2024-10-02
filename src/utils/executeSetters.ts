import type { ValueChangeCallbacks } from '../types';

const executeSetters = (set: ValueChangeCallbacks, value?: unknown) => {
  const it = set.values();

  const next = it.next.bind(it);

  for (let i = set.size; i--; ) {
    next().value(value);
  }
};

export default executeSetters;
