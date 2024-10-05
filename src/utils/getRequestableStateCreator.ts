import type { StateInitializer, RequestableStateOptions } from '../types';
import becomingOnline from './becomingOnline';
import createFetcher from './createFetcher';
import type getAsyncStateCreator from './getAsyncStateCreator';

const handleLoad: Parameters<typeof createFetcher>[0] = (
  cancelPromise,
  load
) => {
  Promise.any([becomingOnline(), cancelPromise]).then(load);
};

const getRequestableStateCreator =
  (createAsyncState: ReturnType<typeof getAsyncStateCreator>) =>
  (
    options: RequestableStateOptions<any, any>,
    stateInitializer?: StateInitializer,
    keys?: any[],
    utils?: Record<string, any>
  ) =>
    createAsyncState(
      {
        ...options,
        load: createFetcher(handleLoad, options),
      },
      stateInitializer,
      keys,
      utils
    );

export default getRequestableStateCreator;
