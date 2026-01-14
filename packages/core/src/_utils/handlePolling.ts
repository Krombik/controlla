import noop from 'lodash.noop';
import type { PollableMethods, InternalAsyncControl } from '#_types';
import type createLoader from '#utils/createLoader';
import { ROOT } from '#shared/constants';
import type { AsyncControl, PollableControlOptions } from '#types';

export class PollingControl implements PollableMethods {
  readonly _interval: number | ((value: any) => number);
  readonly _hiddenInterval: number | ((value: any) => number) | undefined;
  _sleep: () => Promise<void>;
  _pausePromise: Promise<void> | undefined | false = undefined;
  _sleepPromise: Promise<void> | void | false = undefined;
  _resume: () => void = noop;
  reset: () => void = noop;
  readonly _root: InternalAsyncControl;

  constructor(options: PollableControlOptions, control: AsyncControl) {
    const { hiddenInterval } = options;

    this._interval = options.interval;

    this._hiddenInterval = hiddenInterval;

    this._sleep = hiddenInterval == null ? commonSleep : smartSleep;

    this._root = control[ROOT];
  }

  _handleInterval(interval: number | ((value: any) => number)) {
    return typeof interval == 'number' ? interval : interval(this._root._value);
  }

  pause() {
    const self = this;

    if (!self._pausePromise) {
      self._pausePromise = new Promise((res) => {
        self._resume = res;
      });
    }
  }

  resume() {
    const self = this;

    if (self._pausePromise) {
      self._pausePromise = false;

      self._resume();
    }
  }
}

function commonSleep(this: PollingControl) {
  const self = this;

  return new Promise<void>((res) => {
    self.reset = () => {
      clearTimeout(id);

      self.reset = noop;

      res();
    };

    const id = setTimeout(self.reset, self._handleInterval(self._interval));
  });
}

function smartSleep(this: PollingControl) {
  const self = this;

  return new Promise<void>((res) => {
    const listener = () => {
      clearTimeout(timeoutId);

      const delay = self._handleInterval(
        document.hidden ? self._hiddenInterval! : self._interval
      );

      if (delay > 0) {
        const now = performance.now();

        const diff = now - start - delay;

        start = now;

        if (diff > 0) {
          timeoutId = window.setTimeout(self.reset, diff);
        } else {
          self.reset();
        }
      } else {
        timeoutId = undefined;
      }
    };

    self.reset = () => {
      self.reset = noop;

      document.removeEventListener('visibilitychange', listener);

      clearTimeout(timeoutId);

      timeoutId = undefined;

      res();
    };

    const delay = self._handleInterval(
      document.hidden ? self._hiddenInterval! : self._interval
    );

    let timeoutId: number | undefined;

    let start = performance.now();

    document.addEventListener('visibilitychange', listener);

    if (delay > 0) {
      timeoutId = window.setTimeout(self.reset, delay);
    }
  });
}

export const handlePolling: Parameters<
  typeof createLoader<PollingControl>
>[0] = async (cancelPromise, load, self) => {
  const loadingProcess: PollingControl = self._loadingProcess;

  do {
    do {
      if (
        !(await Promise.any([
          Promise.all([
            loadingProcess._sleepPromise,
            loadingProcess._pausePromise,
          ]),
          cancelPromise,
        ]))
      ) {
        loadingProcess._sleepPromise = false;

        return;
      }
    } while (loadingProcess._pausePromise || !navigator.onLine);
  } while (
    await load().then((res) => {
      loadingProcess._sleepPromise = res && loadingProcess._sleep();

      return res;
    })
  );
};
