import { useContext, useLayoutEffect, useState } from 'react';
import type {
  AnyAsyncState,
  AsyncState,
  Falsy,
  WithoutPending,
} from '../types';
import useNoop from '../utils/useNoop';
import UseContext from '../utils/UseContext';
import onValueChange from '../onValueChange';
import getValue from '../getValue';
import getPromise from '../getPromise';
import { RootKey } from '../utils/constants';

const use = ((state: AnyAsyncState<any, any, any[]> | Falsy) => {
  const ctx = useContext(UseContext);

  if (state) {
    const utils = state._internal;

    if (utils._data.has(RootKey.VALUE)) {
      const t = useState<{}>();

      useLayoutEffect(() => {
        const setValue = t[1];

        const forceRerender = () => {
          setValue({});
        };

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

      return getValue(state);
    }

    const errorData = utils._errorUtils._data;

    if (errorData.has(RootKey.VALUE)) {
      throw errorData.get(RootKey.VALUE);
    }

    if ('load' in state && !ctx.has(utils)) {
      ctx.set(utils, state.load());
    }

    throw getPromise(state, true);
  }

  useNoop();
}) as {
  <S extends AsyncState<any> | Falsy>(
    state: S
  ): S extends AsyncState<infer T> ? WithoutPending<T> : undefined;
};

export default use;
