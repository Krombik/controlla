import { Root, RootKey } from '../types';

export const handleGetInterval = (
  interval: number | ((value: any) => number),
  root: Root
) =>
  typeof interval == 'number'
    ? () => interval
    : () => interval(root.get(RootKey.VALUE));

export const commonSleep = (getInterval: () => number) =>
  new Promise<void>((res) => {
    setTimeout(res, getInterval());
  });

export const changingSleep = (getInterval: () => number) =>
  new Promise<void>((res) => {
    const listener = () => {
      window.clearTimeout(timeoutId);

      const delay = getInterval();

      if (delay > 0) {
        const now = performance.now();

        const diff = now - start - delay;

        start = now;

        if (diff > 0) {
          timeoutId = window.setTimeout(resolve, diff);
        } else {
          resolve();
        }
      } else {
        timeoutId = undefined;
      }
    };

    const resolve = () => {
      document.removeEventListener('visibilitychange', listener);

      timeoutId = undefined;

      res();
    };

    const delay = getInterval();

    let timeoutId: number | undefined;

    let start = performance.now();

    document.addEventListener('visibilitychange', listener);

    if (delay > 0) {
      timeoutId = window.setTimeout(resolve, delay);
    }
  });
