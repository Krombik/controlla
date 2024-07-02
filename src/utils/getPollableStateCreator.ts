import type { PollableStateOptions } from '../types';
import becomingOnline from './becomingOnline';
import createFetcher from './createFetcher';
import type getAsyncStateCreator from './getAsyncStateCreator';
import { changingSleep, commonSleep, handleGetInterval } from './interval';

const getPollableStateCreator =
  (createAsyncState: ReturnType<typeof getAsyncStateCreator>) =>
  (options: PollableStateOptions<any, any>) => {
    let sleep: (getInterval: () => number) => Promise<void>;

    let getInterval: () => number;

    let pausePromise: Promise<void> | undefined | false;

    let sleepPromise: Promise<void> | undefined;

    let resume: () => void;

    const state = createAsyncState({
      ...options,
      load: createFetcher(
        options.load,
        options.shouldRetryOnError,
        async (cancelPromise, load) => {
          do {
            do {
              if (
                !(await Promise.any([
                  Promise.all([sleepPromise, pausePromise, becomingOnline()]),
                  cancelPromise,
                ]))
              ) {
                return;
              }
            } while (pausePromise || !navigator.onLine);
          } while (
            await load().then((res) => {
              if (res) {
                sleepPromise = sleep(getInterval);
              }

              return res;
            })
          );
        }
      ),
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
    });

    const root = state.r;

    const { hiddenInterval } = options;

    const getVisibleInterval = handleGetInterval(options.interval, root);

    if (hiddenInterval == null) {
      sleep = commonSleep;

      getInterval = getVisibleInterval;
    } else {
      const getHiddenInterval = handleGetInterval(hiddenInterval, root);

      getInterval = () =>
        (document.hidden ? getHiddenInterval : getVisibleInterval)();

      sleep = changingSleep;
    }

    return state;
  };

export default getPollableStateCreator;
