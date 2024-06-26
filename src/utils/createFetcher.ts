import setError from '../setError';
import setValue from '../setValue';
import { AnyLoadableAsyncState } from '../types';
import becomingOnline from './becomingOnline';
import { EMPTY_ARR, RESOLVED_PROMISE } from './constants';

const createFetcher =
  (
    fetcher: (arg: any) => Promise<any>,
    shouldRetry: ((err: any, attempt: number) => number) | undefined,
    load: (
      cancelPromise: Promise<void>,
      fetch: () => Promise<boolean | void>
    ) => void | Promise<void>
  ) =>
  (state: AnyLoadableAsyncState) => {
    let attempt = 0;

    let isRunning = true;

    let cancel!: () => void;

    const retriableFetcher = (): Promise<boolean | void> =>
      isRunning
        ? fetcher(state.v).then(
            (value) => {
              attempt = 0;

              setValue({ r: state.r, p: EMPTY_ARR }, value);

              return isRunning;
            },
            (err) => {
              if (isRunning) {
                if (!navigator.onLine) {
                  return becomingOnline().then(retriableFetcher);
                }

                if (shouldRetry) {
                  const delay = shouldRetry(err, attempt);

                  if (delay) {
                    attempt++;

                    return new Promise((res) => setTimeout(res, delay)).then(
                      retriableFetcher
                    );
                  }
                }

                setError(state, err);
              }
            }
          )
        : RESOLVED_PROMISE;

    load(
      new Promise<void>((res) => {
        cancel = () => {
          isRunning = false;

          res();
        };
      }),
      retriableFetcher
    );

    return cancel;
  };

export default createFetcher;
