import { RequestableStateOptions } from '../types';
import becomingOnline from './becomingOnline';
import createFetcher from './createFetcher';
import type getAsyncStateCreator from './getAsyncStateCreator';

const getRequestableStateCreator =
  (createAsyncState: ReturnType<typeof getAsyncStateCreator>) =>
  (options: RequestableStateOptions<any, any>) =>
    createAsyncState({
      ...options,
      load: createFetcher(
        options.load,
        options.shouldRetryOnError,
        (cancelPromise, load) => {
          Promise.any([becomingOnline(), cancelPromise]).then(load);
        }
      ),
    });

export default getRequestableStateCreator;
