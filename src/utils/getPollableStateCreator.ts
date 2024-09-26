import noop from 'lodash.noop';
import type { InternalDataMap, PollableStateOptions } from '../types';
import becomingOnline from './becomingOnline';
import createFetcher from './createFetcher';
import type getAsyncStateCreator from './getAsyncStateCreator';
import { RootKey } from './constants';

export const handleGetInterval = (
  interval: number | ((value: any) => number),
  data: InternalDataMap
) =>
  typeof interval == 'number'
    ? () => interval
    : () => interval(data.get(RootKey.VALUE));

const getPollableStateCreator =
  (createAsyncState: ReturnType<typeof getAsyncStateCreator>) =>
  (options: PollableStateOptions<any, any>, keys?: any[]) => {
    let sleep: () => Promise<void>;

    let pausePromise: Promise<void> | undefined | false;

    let sleepPromise: Promise<void> | void | false;

    let resume: () => void;

    let reset: () => void = noop;

    const state = createAsyncState(
      {
        ...options,
        load: createFetcher(async (cancelPromise, load) => {
          do {
            do {
              if (
                !(await Promise.any([
                  Promise.all([sleepPromise, pausePromise, becomingOnline()]),
                  cancelPromise,
                ]))
              ) {
                sleepPromise = false;

                return;
              }
            } while (pausePromise || !navigator.onLine);
          } while (
            await load().then((res) => {
              sleepPromise = res && sleep();

              return res;
            })
          );
        }, options),
        pause() {
          if (!pausePromise) {
            pausePromise = new Promise((res) => {
              resume = res;
            });
          }
        },
        resume() {
          if (pausePromise) {
            pausePromise = false;

            resume();
          }
        },
        reset() {
          reset();
        },
      },
      keys
    );

    const data = state._internal._data;

    const { hiddenInterval } = options;

    const getVisibleInterval = handleGetInterval(options.interval, data);

    if (hiddenInterval == null) {
      sleep = () =>
        new Promise((res) => {
          reset = () => {
            clearTimeout(id);

            reset = noop;

            res();
          };

          const id = setTimeout(reset, getVisibleInterval());
        });
    } else {
      const getHiddenInterval = handleGetInterval(hiddenInterval, data);

      const getInterval = () =>
        (document.hidden ? getHiddenInterval : getVisibleInterval)();

      sleep = () =>
        new Promise<void>((res) => {
          const listener = () => {
            clearTimeout(timeoutId);

            const delay = getInterval();

            if (delay > 0) {
              const now = performance.now();

              const diff = now - start - delay;

              start = now;

              if (diff > 0) {
                timeoutId = window.setTimeout(reset, diff);
              } else {
                reset();
              }
            } else {
              timeoutId = undefined;
            }
          };

          reset = () => {
            reset = noop;

            document.removeEventListener('visibilitychange', listener);

            clearTimeout(timeoutId);

            timeoutId = undefined;

            res();
          };

          const delay = getInterval();

          let timeoutId: number | undefined;

          let start = performance.now();

          document.addEventListener('visibilitychange', listener);

          if (delay > 0) {
            timeoutId = window.setTimeout(reset, delay);
          }
        });
    }

    return state;
  };

export default getPollableStateCreator;
