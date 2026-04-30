import { INTERNALS } from '#shared-internal/constants';
import type { AsyncControlInternals } from '#internal/types';
import type { LoadableControl, LoadableControlOptions } from '#types';

const createLoadRunner = <U extends Record<string, any> = never>(
  loadHandler: (
    fetch: () => Promise<true | void>,
    cancelPromise: Promise<void>,
    self: AsyncControlInternals
  ) => Promise<true | void>,
  fetch: (...args: any[]) => Promise<any>
) =>
  function (this: LoadableControl<any, any, U>, ...args: any[]) {
    const self = this[INTERNALS] as AsyncControlInternals;

    let isRunning = true;

    let cancel!: () => void;

    const cancelPromise = new Promise<void>((res) => {
      cancel = () => {
        isRunning = false;

        res();
      };
    });

    loadHandler(
      async () => {
        if (isRunning) {
          try {
            const value = await fetch(...args);

            if (isRunning) {
              self._enqueueSet(value);

              return true;
            }
          } catch (err) {
            if (isRunning) {
              self._errorControl[INTERNALS]._enqueueSet(err);
            }
          }
        }
      },
      cancelPromise,
      self
    );

    return cancel;
  } as LoadableControlOptions<any, any>['load'];

export default createLoadRunner;
