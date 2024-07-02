import { useLayoutEffect, useState } from 'react';
import type {
  AnyAsyncState,
  AnyLoadableAsyncState,
  AnyState,
  Falsy,
  NOT_LOADED,
} from '../types';
import onValueChange from '../onValueChange';
import getValue from '../getValue';
import useNoop from '../utils/useNoop';
import { RootKey } from '../utils/constants';

const useValue = ((state: AnyLoadableAsyncState | Falsy) => {
  if (state) {
    const root = state.r;

    const t = useState<{}>();

    useLayoutEffect(() => {
      const forceRerender = t[1];

      const unlistenValue = onValueChange(state, () => {
        forceRerender({});
      });

      if (root.has(RootKey.LOAD)) {
        const unregister = root.get(RootKey.LOAD)!(state);

        return () => {
          unlistenValue();

          unregister();
        };
      }

      return unlistenValue;
    }, [root, state._p && state._p.join('.')]);

    return getValue(state);
  }

  useNoop();
}) as {
  <S extends AnyState | Falsy>(
    state: S
  ): S extends AnyAsyncState<infer T>
    ? [Extract<T, typeof NOT_LOADED>] extends [never]
      ? T
      : Exclude<T, typeof NOT_LOADED> | undefined
    : undefined;
};

export default useValue;
