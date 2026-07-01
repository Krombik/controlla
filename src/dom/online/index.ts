import createAsyncControl from '#core/createAsyncControl';
import invalidate from '#core/invalidate';
import setValue from '#core/setValue';
import type { ReadonlyAsyncControl } from '#types';

const $online = createAsyncControl<true, never>(
  typeof navigator !== 'undefined' && navigator.onLine
    ? { value: true }
    : undefined
);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setValue($online, true);
  });

  window.addEventListener('offline', () => {
    invalidate($online);
  });
}

/**
 * Connectivity as an async control: `true` while online, `undefined` while
 * offline (offline = not ready). `useValue` reads `true`/`undefined`;
 * `toPromise($online)` resolves on the next reconnection, and
 * `useSuspenseValue($online)` suspends a component until online.
 */
export default $online as ReadonlyAsyncControl<true, never>;
