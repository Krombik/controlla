import type {
  AsyncControlOptions,
  AsyncControlScope,
  SyncExternalStorage,
} from '#types';
import createAsyncControl from '#core/createAsyncControl';
import makeUseControl from '#internal/makeUseControl';

/**
 * Creates a component-bound {@link AsyncControlScope async control} on the
 * first render and returns the same instance afterwards.
 *
 * Options can be provided as a factory, which is invoked only once — prefer
 * it when the options are built by a loader (e.g. `requestLoader`,
 * `pollLoader`), so the loader isn't recreated on every render:
 *
 * @example
 * ```tsx
 * const Component = () => {
 *   const $user = useAsyncControl(() =>
 *     requestLoader(() => fetch('/api/me').then((r) => r.json()))
 *   );
 *
 *   const user = useValue($user);
 *
 *   // ...
 * };
 * ```
 */
const useAsyncControl: {
  <T, E = any>(
    options?: AsyncControlOptions<T, E> | (() => AsyncControlOptions<T, E>),
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): AsyncControlScope<T, E>;
} = makeUseControl(createAsyncControl, true);

export default useAsyncControl;
