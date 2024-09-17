import type { RequestableStateOptions } from '../types';
import becomingOnline from './becomingOnline';
import createFetcher from './createFetcher';
import type getAsyncStateCreator from './getAsyncStateCreator';

const getRequestableStateCreator =
  (createAsyncState: ReturnType<typeof getAsyncStateCreator>) =>
  (options: RequestableStateOptions<any, any>) =>
    createAsyncState({
      ...options,
      load: createFetcher((cancelPromise, load) => {
        Promise.any([becomingOnline(), cancelPromise]).then(load);
      }, options),
    });

export default getRequestableStateCreator;
