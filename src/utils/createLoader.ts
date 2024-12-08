import type {
  LoadableState,
  LoadableStateOptions,
  RequestableStateOptions,
} from '../types';
import becomingOnline from './becomingOnline';
import { RESOLVED_PROMISE } from './constants';
import type { PrimitiveOrNested } from 'keyweaver';

const createLoader = <U extends Record<string, any> = never>(
  handleLoad: (
    cancelPromise: Promise<void>,
    fetch: () => Promise<PrimitiveOrNested[] | void>,
    self: LoadableState<any, any, U>
  ) => void | Promise<void>,
  { load, shouldRetryOnError }: RequestableStateOptions<any, any, any[]>
) =>
  function (this: LoadableState<any, any, U>, ...args: any[]) {
    const self = this;

    let attempt = 0;

    let isRunning = true;

    let cancel!: () => void;

    const cancelPromise = new Promise<void>((res) => {
      cancel = () => {
        isRunning = false;

        res();
      };
    });

    const retriableFetcher = (): Promise<PrimitiveOrNested[] | void> =>
      isRunning
        ? load(...args).then(
            (value) => {
              attempt = 0;

              if (isRunning) {
                self.set(value, false);

                return args;
              }
            },
            (err) => {
              if (isRunning) {
                if (!navigator.onLine) {
                  return becomingOnline().then(retriableFetcher);
                }

                if (shouldRetryOnError) {
                  const delay = shouldRetryOnError(err, attempt);

                  if (delay) {
                    attempt++;

                    return new Promise((res) => {
                      setTimeout(res, delay);
                    }).then(retriableFetcher);
                  }
                }

                self.error.set(err);
              }
            }
          )
        : RESOLVED_PROMISE;

    handleLoad(
      cancelPromise,
      () => {
        if (isRunning) {
          self._internal._isFetchInProgress = true;
        }

        return retriableFetcher();
      },
      self
    );

    return cancel;
  } as LoadableStateOptions<any, any>['load'];

export default createLoader;
