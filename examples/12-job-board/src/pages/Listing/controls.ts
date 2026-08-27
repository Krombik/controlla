/**
 * The page's data, as a bag instead of module-level controls.
 *
 * `createControlsContext` builds the bag once per mounted provider, so these
 * controls live exactly as long as the page does: leave the listing and the
 * bound controls go with it, instead of holding a registry item for the rest of
 * the session. Everything else about them is unchanged - a bag is where controls
 * are declared, not a new way of reading them.
 *
 * `createBoundControl` is the point. `createBoundControl(listingRegistry, $id)`
 * is not "the listing with the current id" evaluated now - it is a control that
 * follows the id: navigate to another listing and every section reading it
 * re-points at the new data, with no props threaded down and no effect re-running
 * a fetch.
 *
 * `$company` binds to a value read *out of* another async control, so it starts
 * loading only once the listing has arrived and told us the company name.
 */

import createControlsContext from 'controlla/core/createControlsContext';
import createBoundControl from 'controlla/core/createBoundControl';
import selectParams from 'controlla/router/selectParams';

import { companyRegistry, listingRegistry } from '#controls/listings';
import { router } from '#router';

/**
 * The bag hands out the route's param too, so everything under the provider
 * reads one thing. It is not created here: a param control is the URL, which
 * outlives any mount, and `selectParams` is a property read - `preloads.ts`
 * asks for the same control without going near React.
 *
 * A number, because the route declared `parse: Number` for this param.
 */
export const [ListingProvider, useListing] = createControlsContext(() => {
  const $id = selectParams(router.routes.listing).id;

  const $listing = createBoundControl(listingRegistry, $id);

  return {
    $id,
    $listing,
    $company: createBoundControl(companyRegistry, $listing.company),
  };
});
