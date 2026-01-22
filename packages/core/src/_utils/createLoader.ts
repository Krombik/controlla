import { ROOT } from '#shared/constants';
import type { AsyncControlRoot } from '#_types';
import type { LoadableControl, LoadableControlOptions } from '#types';

const createLoader = <U extends Record<string, any> = never>(
  handleLoad: (
    fetch: () => Promise<true | void>,
    cancelPromise: Promise<void>,
    self: AsyncControlRoot
  ) => Promise<true | void>,
  fetch: (...args: any[]) => Promise<any>
) =>
  function (this: LoadableControl<any, any, U>, ...args: any[]) {
    const self = this[ROOT];

    let isRunning = true;

    let cancel!: () => void;

    const cancelPromise = new Promise<void>((res) => {
      cancel = () => {
        isRunning = false;

        res();
      };
    });

    handleLoad(
      async () => {
        if (isRunning) {
          self._isFetchInProgress = true;

          try {
            const value = await fetch(...args);

            if (isRunning) {
              self._enqueueSet(value);

              return true;
            }
          } catch (err) {
            if (isRunning) {
              self._errorControl[ROOT]._enqueueSet(err);
            }
          } finally {
            self._isFetchInProgress = false;
          }
        }
      },
      cancelPromise,
      self
    );

    return cancel;
  } as LoadableControlOptions<any, any>['load'];

export default createLoader;
