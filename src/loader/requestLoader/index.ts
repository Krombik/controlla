import type { PrimitiveOrNested } from 'keyweaver';
import type { AsyncControlOptions, Scheduler } from '#types';

/**
 * Creates {@link AsyncControlOptions options} for an async control that loads
 * via a request: on each load {@link fetch} is called with the control's
 * keys, and the result (or rejection) is committed to the control. Pass extra
 * {@link options} (`reloadIfStale`, `loadingTimeout`, …) to merge in, and a
 * {@link scheduler} to batch result commits.
 *
 * @example
 * ```ts
 * // standalone control — fetch takes no arguments
 * const $products = createAsyncControl(
 *   requestLoader(() => fetch('/api/products').then((r) => r.json()))
 * );
 *
 * // in a registry — keys are passed to fetch
 * const productRegistry = createRegistry(
 *   createAsyncControl,
 *   requestLoader((id: number) =>
 *     fetch(`/api/products/${id}`).then((r) => r.json())
 *   )
 * );
 * ```
 */
const requestLoader: <T, E = any, Keys extends PrimitiveOrNested[] = []>(
  fetch: (...args: Keys) => Promise<T>,
  options?: Omit<AsyncControlOptions<T, E, Keys>, 'load' | 'isLoaded'>,
  scheduler?: Scheduler
) => AsyncControlOptions<T, E, Keys> = (
  fetch: (...args: any[]) => Promise<any>,
  options,
  scheduler?: Scheduler
) => ({
  ...options,
  load(handle, keys?: any[]) {
    (keys ? fetch(...keys) : fetch()).then(
      (value) => {
        if (handle.stillLoading()) {
          handle.setValue(value, scheduler);
        }
      },
      (error) => {
        if (handle.stillLoading()) {
          handle.setError(error, scheduler);
        }
      }
    );
  },
});

export default requestLoader;
