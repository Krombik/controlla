import { useLayoutEffect, useState } from 'react';
import { AnyLoadableAsyncState, AnyState, Falsy, RootKey } from '../types';
import onValueChange from '../onValueChange';
import getValue from '../getValue';
import useNoop from '../utils/useNoop';

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
        const unregister = root.get(RootKey.LOAD)!(state.v);

        return () => {
          unlistenValue();

          unregister();
        };
      }

      return unlistenValue;
    }, [root, state.p && state.p.join('.')]);

    return getValue(state);
  }

  useNoop();
}) as {
  <S extends AnyState | Falsy>(
    state: S
  ): S extends AnyState<infer T> ? T : undefined;
};

export default useValue;
