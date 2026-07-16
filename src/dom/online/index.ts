import createAsyncControl from '#core/createAsyncControl';
import invalidate from '#core/invalidate';
import setValue from '#core/setValue';
import type { ReadonlyAsyncControl } from '#types';

const $online = createAsyncControl<true, never>({
  initialValue:
    typeof navigator !== 'undefined' && navigator.onLine ? true : undefined,
});

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setValue($online, true);
  });

  window.addEventListener('offline', () => {
    invalidate($online);
  });
}

/**
 * An async control of connectivity: `true` while online, `undefined` while
 * offline. Since offline means "not ready", the async tooling just works —
 * `toPromise($online)` waits for reconnection, `useSuspenseValue($online)`
 * suspends a component while offline.
 */
export default $online as ReadonlyAsyncControl<true, never>;
