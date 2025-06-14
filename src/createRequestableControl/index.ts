import type {
  ControlInitializer,
  LoadableControl,
  RequestableControlOptions,
} from '../types';
import { ROOT } from '../utils/constants';
import createLoader from '../utils/createLoader';
import getAsyncControl from '../utils/getAsyncControl';
import { handleFetch } from '../utils/handleFetch';
import { set } from '../utils/control/common';

const createRequestableControl = ((
  options: RequestableControlOptions<any, any, any[]>,
  controlInitializer?: ControlInitializer,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void,
  parent?: any
) => ({
  [ROOT]: getAsyncControl(
    set,
    options,
    createLoader(handleFetch, options),
    keys,
    controlInitializer,
    undefined,
    tickStart,
    tickEnd,
    parent
  ),
})) as {
  /**
   * Creates a {@link LoadableControl loadable control} that supports asynchronous data loading on request.
   * The created control manages loading and error handling for data requests, providing
   * a flexible way to manage request-based control updates.
   */
  <T, E = any>(
    options: RequestableControlOptions<T, E>,
    controlInitializer?: ControlInitializer<T | undefined>
  ): LoadableControl<T, E>;
};

export default createRequestableControl;
