import noop from 'lodash.noop';
import setValue from '../setValue';
import type { LoadableStateOptions, RequestableStateOptions } from '../types';
import becomingOnline from './becomingOnline';
import { RESOLVED_PROMISE } from './constants';
import type { PrimitiveOrNested } from 'keyweaver';

const createFetcher = (
  handleLoad: (
    cancelPromise: Promise<void>,
    fetch: () => Promise<PrimitiveOrNested[] | void>
  ) => void | Promise<void>,
  {
    load,
    _afterLoad,
    _beforeLoad = noop,
    shouldRetryOnError,
  }: RequestableStateOptions<any, any>
): LoadableStateOptions<any>['load'] =>
  function (...args) {
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
                setValue(self, value);

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

                setValue(self.error, err);
              }
            }
          )
        : RESOLVED_PROMISE;

    handleLoad(cancelPromise, () => {
      const utils = self._internal;

      if (isRunning) {
        utils._isFetchInProgress = true;
      }

      _beforeLoad(args, utils);

      return retriableFetcher().then(
        _afterLoad && ((args) => _afterLoad(args, utils))
      );
    });

    return cancel;
  };

export default createFetcher;
