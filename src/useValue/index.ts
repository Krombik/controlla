import { useLayoutEffect, useState } from 'react';
import type { AnyAsyncState, Falsy, Pending, State } from '../types';
import onValueChange from '../onValueChange';
import useNoop from '../utils/useNoop';
import getValue from '../getValue';

const useValue = ((state: AnyAsyncState | Falsy) => {
  if (state) {
    const t = useState<{}>();

    useLayoutEffect(() => {
      const forceRerender = t[1];

      const unlistenValue = onValueChange(state, () => {
        forceRerender({});
      });

      if ('load' in state) {
        const unload = state.load();

        return () => {
          unlistenValue();

          unload();
        };
      }

      return unlistenValue;
    }, [state._internal, state._path && state._path.join('.')]);

    return getValue(state);
  }

  useNoop();
}) as {
  <S extends State | Falsy>(
    state: S
  ): S extends State<infer T>
    ? [Extract<T, Pending>] extends [never]
      ? T
      : Exclude<T, Pending> | undefined
    : undefined;
};

export default useValue;
