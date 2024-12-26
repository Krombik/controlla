import type {
  StateInitializer,
  LoadableState,
  RequestableStateOptions,
  ValueChangeCallbacks,
} from '../types';
import createLoader from '../utils/createLoader';
import getAsyncState from '../utils/getAsyncState';
import { handleFetch } from '../utils/handleFetch';
import { _onValueChange, set } from '../utils/state/common';

const createRequestableState = ((
  options: RequestableStateOptions<any, any, any[]>,
  stateInitializer?: StateInitializer,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void,
  parent?: any
) =>
  getAsyncState<ValueChangeCallbacks>(
    set,
    _onValueChange,
    options,
    stateInitializer,
    keys,
    new Set(),
    createLoader(handleFetch, options),
    undefined,
    tickStart,
    tickEnd,
    parent
  )) as {
  /**
   * Creates a {@link LoadableState loadable state} that supports asynchronous data loading on request.
   * The created state manages loading and error handling for data requests, providing
   * a flexible way to manage request-based state updates.
   */
  <T, E = any>(
    options: RequestableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): LoadableState<T, E>;
};

export default createRequestableState;
