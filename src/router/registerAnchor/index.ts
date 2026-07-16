import type { ControlInternals } from '#internal/types';
import type { AnchorEntry, AnchorRoute } from '#router/internal/types';
import { INTERNALS } from '#internal/constants';
import { getLane, scheduleFlush } from '#internal/flushQueue';
import removeFromArray from '#internal/removeFromArray';

/**
 * Registers an element as the scroll target for the given anchor {@link id}
 * on {@link route}: spread the result onto the element. Scroll options come
 * from the route's `anchor()` declaration.
 *
 * Returns a cached handle per id, safe to call during render.
 *
 * @example
 * ```tsx
 * <section {...registerAnchor(route, 'filters')} />
 * ```
 */
const registerAnchor = <A extends string>(route: AnchorRoute<A>, id: A) => {
  const anchorParam = route._anchor!;

  let handle = anchorParam._handles.get(id);

  if (!handle) {
    let entry: AnchorEntry | undefined;

    anchorParam._handles.set(
      id,
      (handle = {
        id,
        ref(el) {
          const lane = getLane(requestAnimationFrame);

          const root = anchorParam._registered[INTERNALS] as ControlInternals;

          if (el) {
            if (entry) {
              entry._el = el;
            } else {
              anchorParam._entries.push((entry = { _id: id, _el: el }));
            }

            root._enqueueSet(
              anchorParam._activeId == id ? 'active' : true,
              lane,
              [id]
            );

            if (anchorParam._isPending) {
              anchorParam._isPending = false;

              lane._beforeFlushHooks.push(() => {
                const value = anchorParam._hash._value;

                if (value) {
                  anchorParam._scrollTo(value, true);
                }
              });
            }
          } else if (entry) {
            removeFromArray(anchorParam._entries, entry);

            root._enqueueSet(undefined, lane, [id]);

            entry = undefined;
          }

          scheduleFlush(lane);
        },
      })
    );
  }

  return handle;
};

export default registerAnchor;
