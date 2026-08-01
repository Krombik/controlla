/**
 * The page's data, declared once and imported by every section below it.
 *
 * `bind` is the point. `listingRegistry.bind($id)` is not "the listing with the
 * current id" evaluated now - it is a control that follows the id: navigate to
 * another listing and every section reading these re-points at the new data,
 * with no props threaded down and no effect re-running a fetch.
 *
 * `$company` binds to a value read *out of* another async control, so it starts
 * loading only once the listing has arrived and told us the company name.
 */

import selectParams from 'controlla/router/selectParams';

import { companyRegistry, listingRegistry } from '#controls/listings';
import { router } from '#router';

/** A number, because the route declared `parse: Number` for this param. */
export const $id = selectParams(router.routes.listing).id;

export const $listing = listingRegistry.bind($id);

export const $company = companyRegistry.bind($listing.company);
