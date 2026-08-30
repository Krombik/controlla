import createAsyncControl from '#core/createAsyncControl';
import scheduleSet from '#internal/scheduleSet';
import { INTERNALS, RELOAD } from '#internal/constants';
import type { ReadonlyAsyncControl } from '#types';

const $online = createAsyncControl<true, never>({
  initialValue:
    typeof navigator !== 'undefined' && navigator.onLine ? true : undefined,
});

if (typeof window != 'undefined') {
  window.addEventListener('online', () => {
    scheduleSet($online[INTERNALS]._root, true, true);
  });

  window.addEventListener('offline', () => {
    // what `invalidate` does, but the connection dropping is not somebody
    // asking for a reload
    scheduleSet(
      $online[INTERNALS]._root._errorControl[INTERNALS],
      RELOAD,
      true
    );
  });
}

/**
 * An async control of connectivity: `true` while online, `undefined` while
 * offline. Since offline means "not ready", the async tooling just works —
 * `toPromise($online)` waits for reconnection, `useSuspenseValue($online)`
 * suspends a component while offline.
 */
export default $online as ReadonlyAsyncControl<true, never>;
