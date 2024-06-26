import { AnyAsyncState, RootKey } from '../types';
import executeSetters from './executeSetters';

const setIsLoaded = (state: AnyAsyncState, value: boolean) => {
  const root = state.r;

  if (root.get(RootKey.IS_LOADED)! != value) {
    root.set(RootKey.IS_LOADED, value);

    executeSetters(root.get(RootKey.IS_LOADED_CALLBACK_SET)!, value);
  }

  return state;
};

export default setIsLoaded;
