import type { Hash, ProcessParams, RouteParams } from '#router/internal/types';
import type { Scheduler } from '#types';

const updateParams: {
  /**
   * Updates the matched {@link route}'s params — a full params object or an
   * updater receiving the current value — committing the controls and syncing
   * the URL. Pushes a history entry by default; pass {@link replace} to
   * replace the current one. A custom {@link scheduler} batches the commit
   * and the URL write (e.g. to throttle rapid updates).
   *
   * The {@link hash} argument sets the route's anchor (scrolling to the
   * registered element); when omitted the current hash is kept.
   *
   * Ignored (with a dev warning) when the route isn't matched.
   *
   * @example
   * ```ts
   * updateParams(routesRoot.search, (prev) => ({ ...prev, sorting }));
   * ```
   */
  <P extends {}, A extends boolean>(
    route: RouteParams<P, A>,
    params: ProcessParams<P, A extends true ? P | undefined : P>,
    hash?: Hash,
    replace?: boolean,
    scheduler?: Scheduler
  ): void;
} = (route: any, params: any, ...rest: any[]) => {
  // rest spread keeps the arity: a hash that wasn't passed stays "omitted"
  // (kept) rather than becoming an explicit clear
  route._update(params, ...rest);
};

export default updateParams;
