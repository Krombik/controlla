import createAsyncControl from '#core/createAsyncControl';
import type { ReadonlyAsyncControl } from '#types';

/**
 * `true` once the router has a location to match.
 *
 * React Native has to ask the OS for the url the app was launched with, and
 * that answer only comes back a tick later - until it does, no route is
 * matched and every param reads as `undefined`. A `createRouterView` handles
 * itself (it renders nothing until something matches); this is for whatever
 * sits *outside* it and reads params - an app shell, a header - so it can wait
 * instead of rendering a frame of defaults.
 *
 * There is no web counterpart: a browser has a location before anything
 * renders, so nothing there ever waits for one.
 *
 * @example
 * ```tsx
 * // the shell waits for the launch url rather than rendering defaults
 * <Suspense fallback={<Splash />}>
 *   <Header />
 *   <RouterView />
 * </Suspense>
 * ```
 */
const $routerReady = createAsyncControl<true, never>({});

export default $routerReady as ReadonlyAsyncControl<true, never>;
