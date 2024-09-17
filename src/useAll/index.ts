import { useContext, useLayoutEffect, useState } from 'react';
import type { AnyAsyncState, Falsy, ExtractValues, AsyncState } from '../types';
import getPromise from '../getPromise';
import onValueChange from '../onValueChange';
import getValue from '../getValue';
import noop from 'lodash.noop';
import UseContext from '../utils/UseContext';
import { RootKey } from '../utils/constants';

const useAll = ((...states: (AnyAsyncState | Falsy)[]) => {
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
      const utils = state._internal;

      const errorData = utils._errorUtils._data;

      if (errorData.has(RootKey.VALUE)) {
        throw errorData.get(RootKey.VALUE)!;
      }

      if (!utils._data.has(RootKey.VALUE)) {
        const unloadedStates: AnyAsyncState[] = [state];

        while (++i < l) {
          const state = states[i];

          if (state) {
            const utils = state._internal;

            const errorData = utils._errorUtils._data;

            if (errorData.has(RootKey.VALUE)) {
              throw errorData.get(RootKey.VALUE)!;
            }

            if (!utils._data.has(RootKey.VALUE)) {
              unloadedStates.push(state);
            }
          }
        }

        const promises: Promise<any>[] = [];

        for (let i = 0; i < unloadedStates.length; i++) {
          const state = unloadedStates[i];

          const utils = state._internal;

          promises.push(getPromise(state, true));

          if ('load' in state && !ctx.has(utils)) {
            ctx.set(utils, state.load());
          }
        }

        throw Promise.all(promises);
      }

      useLayoutEffect(() => {
        const unlistenValue = onValueChange(state, forceRerender);

        const unlistenError = onValueChange(state.error, forceRerender);

        let unregister: () => void;

        if ('load' in state) {
          if (ctx.has(utils)) {
            unregister = ctx.get(utils)!;

            ctx.delete(utils);
          } else {
            unregister = state.load();
          }
        }

        return () => {
          unlistenValue();

          unlistenError();

          unregister && unregister();
        };
      }, [utils, state._path && state._path.join('.')]);

      values.push(getValue(state));
    } else {
      values.push(useLayoutEffect(noop, [0, 0]));
    }
  }

  return values;
}) as {
  <const S extends (AsyncState<any> | Falsy)[]>(...states: S): ExtractValues<S>;
};

export default useAll;
