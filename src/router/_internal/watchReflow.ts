import noop from '#internal/noop';
import { PASSIVE } from '#internal/constants';

/**
 * Runs {@link apply} again on every reflow, for 3s or until the user scrolls -
 * a position aimed at while the page is still filling in is aimed at too early.
 * Returns the stop, so the next aim can cancel this one.
 */
const watchReflow: (apply: () => void) => () => void =
  typeof ResizeObserver != 'undefined'
    ? (apply) => {
        const stop = () => {
          clearTimeout(timer);

          observer.disconnect();

          window.removeEventListener('wheel', stop);
          window.removeEventListener('touchmove', stop);
          window.removeEventListener('keydown', stop);
        };

        window.addEventListener('wheel', stop, PASSIVE);
        window.addEventListener('touchmove', stop, PASSIVE);
        window.addEventListener('keydown', stop, PASSIVE);

        const observer = new ResizeObserver(apply);

        const timer = setTimeout(stop, 3000);

        observer.observe(document.documentElement);

        return stop;
      }
    : () => noop;

export default watchReflow;
