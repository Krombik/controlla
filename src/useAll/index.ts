import { useContext, useLayoutEffect, useState } from 'react';
import type {
  AnyAsyncState,
  AnyLoadableAsyncState,
  Falsy,
  ValuesOf,
} from '../types';
import getPromise from '../getPromise';
import onValueChange from '../onValueChange';
import onError from '../onError';
import getValue from '../getValue';
import noop from 'lodash.noop';
import UseContext from '../utils/UseContext';
import { RootKey } from '../utils/constants';

const useAll = ((...states: (AnyLoadableAsyncState | Falsy)[]) => {
  const l = states.length;

  const values: any[] = [];

  const ctx = useContext(UseContext);

  const setValue = useState<{}>()[1];

  const forceRerender = () => {
    setValue({});
  };

  for (let i = 0; i < l; i++) {
    const state = states[i];

    if (state) {
      const root = state.r;

      if (root.has(RootKey.ERROR)) {
        throw root.get(RootKey.ERROR)!;
      }

      if (!root.has(RootKey.VALUE)) {
        const unloadedStates: AnyLoadableAsyncState[] = [state];

        while (++i < l) {
          const state = states[i];

          if (state) {
            const root = state.r;

            if (root.has(RootKey.ERROR)) {
              throw root.get(RootKey.ERROR);
            }

            if (!root.has(RootKey.VALUE)) {
              unloadedStates.push(state);
            }
          }
        }

        const promises: Promise<any>[] = [];

        for (let i = 0; i < unloadedStates.length; i++) {
          const state = unloadedStates[i];

          const root = state.r;

          promises.push(getPromise({ r: root }));

          if (root.has(RootKey.LOAD) && !ctx.has(root)) {
            ctx.set(root, root.get(RootKey.LOAD)!(state));
          }
        }

        throw Promise.all(promises);
      }

      useLayoutEffect(() => {
        const unlistenValue = onValueChange(state, forceRerender);

        const unlistenError = onError(state, forceRerender);

        let unregister: () => void;

        if (root.has(RootKey.LOAD)) {
          if (ctx.has(root)) {
            unregister = ctx.get(root)!;

            ctx.delete(root);
          } else {
            unregister = root.get(RootKey.LOAD)!(state);
          }
        }

        return () => {
          unlistenValue();

          unlistenError();

          unregister && unregister();
        };
      }, [root, state._p && state._p.join('.')]);

      values.push(getValue(state));
    } else {
      values.push(useLayoutEffect(noop, [0, 0]));
    }
  }

  return values;
}) as {
  <const S extends (AnyAsyncState | Falsy)[]>(...states: S): ValuesOf<S>;
};

export default useAll;
