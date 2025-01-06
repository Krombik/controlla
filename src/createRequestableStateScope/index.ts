import type {
  StateInitializer,
  RequestableStateOptions,
  LoadableStateScope,
} from '../types';
import createLoader from '../utils/createLoader';
import createScope from '../utils/createScope';
import getAsyncState from '../utils/getAsyncState';
import { handleFetch } from '../utils/handleFetch';
import { set } from '../utils/state/scope';

const createRequestableStateScope: {
  /**
   * Creates a {@link LoadableStateScope loadable state scope} that supports asynchronous data loading on request.
   * The created state manages loading and error handling for data requests, providing
   * a flexible way to manage request-based state updates.
   */
  <T, E = any>(
    options: RequestableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): LoadableStateScope<T, E>;
} = (
  options: RequestableStateOptions<any, any, any[]>,
  stateInitializer?: StateInitializer,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void,
  parent?: any
) =>
  createScope(
    getAsyncState(
      set,
      options,
      stateInitializer,
      keys,
      createLoader(handleFetch, options),
      undefined,
      tickStart,
      tickEnd,
      parent
    )
  );

export default createRequestableStateScope;
