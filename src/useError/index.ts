import getError from '../getError';
import onError from '../onError';
import type { AnyAsyncState, Falsy } from '../types';
import createUseValueOf from '../utils/createUseValueOf';

const useError = createUseValueOf(onError, getError) as {
  <S extends AnyAsyncState | Falsy>(
    state: S
  ): S extends AnyAsyncState<any, infer E> ? E : undefined;
};

export default useError;
