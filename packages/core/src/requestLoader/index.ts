import type { PrimitiveOrNested } from 'keyweaver';
import type { AsyncControlOptions, Scheduler } from '#types';

/**
 * Creates an {@link AsyncSource.load load} function for a request-based
 * {@link AsyncSource}. On each (re)load it calls {@link fetch} with the control's
 * keys, writing the resolved value to the control or the rejection to its error.
 * The returned cleanup ignores a result that arrives after the load is canceled.
 *
 * @example
 * ```ts
 * // standalone control — no keys, fetch takes no arguments
 * const productsControl = createAsyncControl({
 *   source: { load: request(() => fetch('/api/products').then((r) => r.json())) },
 * });
 *
 * // in a registry — keys are passed to fetch
 * const productRegistry = createRegistry(createAsyncControl, {
 *   source: {
 *     load: request((id: number) =>
 *       fetch(`/api/products/${id}`).then((r) => r.json())
 *     ),
 *   },
 * });
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
