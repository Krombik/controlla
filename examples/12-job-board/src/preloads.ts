/**
 * What starts loading before React does.
 *
 * This is the one place a module-level `watchValue` belongs. The file sits next
 * to the router and is imported by `main.tsx`, so by the time the script has
 * been parsed the current URL is already matched and the page's requests are in
 * flight - nothing had to mount first, and nothing waits on the rest of the
 * bundle. React then renders into data that is already on its way.
 *
 * The shape is always the same: watch the route's params (or the route itself),
 * `retain` what the page will want, and hand the release back as the watcher's
 * cleanup. `retain` keeps a control loading without reading its value, so this
 * file renders nothing and subscribes to nothing else.
 */

import retain from 'controlla/core/retain';
import watchValue from 'controlla/core/watchValue';
import selectParams from 'controlla/router/selectParams';

import { JUMP_IDS, listingRegistry } from '#controls/listings';
import { $results } from '#pages/Search/controls';
import { router } from '#router';

/** A param control holds `undefined` while its route is not matched. */
const $id = selectParams(router.routes.listing).id;

/**
 * On a listing, hold the ones its nav offers to jump to - the page reads the
 * current listing itself, so what is worth prefetching is where the user goes
 * next. Leaving the route releases them: whatever loaded stays cached, it just
 * stops being kept warm.
 */
watchValue(
  $id,
  (id) => {
    if (id === undefined) {
      return;
    }

    const releases = JUMP_IDS.map((other) =>
      retain(listingRegistry.get(other))
    );

    return () => {
      for (let i = 0; i < releases.length; i++) {
        releases[i]();
      }
    };
  },
  true
);

/**
 * The search results for whatever is in the query string, started at parse time
 * rather than when `Results` mounts. `retain` returns its own release, so the
 * watcher's callback is the whole thing.
 */
watchValue(
  router.routes.search,
  (isMatched) => (isMatched ? retain($results) : undefined),
  true
);
