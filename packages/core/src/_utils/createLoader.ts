import { ROOT } from '#shared/constants';
import type { InternalAsyncControl } from '#_types';
import type {
  LoadableControl,
  LoadableControlOptions,
  RequestableControlOptions,
} from '#types';
import { RESOLVED_PROMISE } from '#utils/constants';

const createLoader = <U extends Record<string, any> = never>(
  handleLoad: (
    cancelPromise: Promise<void>,
    fetch: () => Promise<true | void>,
    self: InternalAsyncControl
  ) => void | Promise<void>,
  { fetch, shouldRetryOnError }: RequestableControlOptions<any, any, any[]>
) =>
  function (this: LoadableControl<any, any, U>, ...args: any[]) {
    const self = this as Partial<InternalAsyncControl> as InternalAsyncControl;

    let attempt = 0;

    let isRunning = true;

    let cancel!: () => void;

    const cancelPromise = new Promise<void>((res) => {
      cancel = () => {
        isRunning = false;

        res();
      };
    });

    const retriableFetcher = (): Promise<true | void> =>
      isRunning
        ? fetch(...args).then(
            (value) => {
              attempt = 0;

              if (isRunning) {
                self._set(value);

                return true;
              }
            },
            (err) => {
              if (isRunning) {
                if (shouldRetryOnError) {
                  const delay = shouldRetryOnError(err, attempt);

                  if (delay) {
                    attempt++;

                    return new Promise((res) => {
                      setTimeout(res, delay);
                    }).then(retriableFetcher);
                  }
                }

                self._errorControl[ROOT]._set(err);
              }
            }
          )
        : RESOLVED_PROMISE;

    handleLoad(
      cancelPromise,
      async () => {
        if (isRunning) {
          self._isFetchInProgress = true;
        }

        const res = await retriableFetcher();

        self._isFetchInProgress = false;

        return res;
      },
      self
    );

    return cancel;
  } as LoadableControlOptions<any, any>['load'];

export default createLoader;
