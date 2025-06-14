import type {
  ControlInitializer,
  RequestableControlOptions,
  LoadableControlScope,
} from '../types';
import createLoader from '../utils/createLoader';
import createScope from '../utils/createScope';
import getAsyncControl from '../utils/getAsyncControl';
import { handleFetch } from '../utils/handleFetch';
import { set } from '../utils/control/scope';

const createRequestableControlScope: {
  /**
   * Creates a {@link LoadableControlScope loadable control scope} that supports asynchronous data loading on request.
   * The created control manages loading and error handling for data requests, providing
   * a flexible way to manage request-based control updates.
   */
  <T, E = any>(
    options: RequestableControlOptions<T, E>,
    controlInitializer?: ControlInitializer<T | undefined>
  ): LoadableControlScope<T, E>;
} = (
  options: RequestableControlOptions<any, any, any[]>,
  controlInitializer?: ControlInitializer,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void,
  parent?: any
) =>
  createScope(
    getAsyncControl(
      set,
      options,
      createLoader(handleFetch, options),
      keys,
      controlInitializer,
      undefined,
      tickStart,
      tickEnd,
      parent
    )
  );

export default createRequestableControlScope;
