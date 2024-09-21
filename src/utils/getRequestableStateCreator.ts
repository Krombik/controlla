import type { RequestableStateOptions } from '../types';
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
  (options: RequestableStateOptions<any, any>) =>
    createAsyncState({
      ...options,
      load: createFetcher(handleLoad, options),
    });

export default getRequestableStateCreator;
