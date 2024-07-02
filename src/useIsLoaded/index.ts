import isLoaded from '../isLoaded';
import onIsLoadedChange from '../onIsLoadedChange';
import type { AnyAsyncState, Falsy } from '../types';
import createUseValueOf from '../utils/createUseValueOf';

const useIsLoaded = createUseValueOf(onIsLoadedChange, isLoaded) as {
  <S extends AnyAsyncState | Falsy>(
    state: S
  ): S extends AnyAsyncState ? boolean : undefined;
};

export default useIsLoaded;
