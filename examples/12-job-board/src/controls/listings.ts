/**
 * Server-backed state. Registries, not fetch calls in components: one control
 * per key, created the first time something asks for it, cached and shared
 * after. Two components reading the same listing share one request.
 */

import createRegistry from 'controlla/core/createRegistry';
import createAsyncControl from 'controlla/core/createAsyncControl';
import requestLoader from 'controlla/loader/requestLoader';
import pollLoader from 'controlla/loader/pollLoader';

import {
  fetchCompany,
  fetchListing,
  searchListings,
  type SearchQuery,
} from '#api';

/** `listingRegistry.get(1003)` / `.bind($idControl)` - keyed by listing id. */
export const listingRegistry = createRegistry(
  createAsyncControl,
  requestLoader(fetchListing)
);

/** Keyed by company name, loaded independently of the listing itself. */
export const companyRegistry = createRegistry(
  createAsyncControl,
  requestLoader(fetchCompany)
);

/**
 * The search backend answers with a partial match set first, so a plain request
 * would show half the results and stop. `pollLoader` keeps asking until
 * `isLoaded` is satisfied, and `syncedKeysCount: 1` puts every page of one
 * query on a single shared clock - so page 0 and page 1 refetch together
 * instead of drifting into separate polling loops.
 */
const searchPoll = pollLoader(
  (query: SearchQuery, page: number) => searchListings(query, page),
  {
    interval: 2000,
    isLoaded: (page) => page.isFinished,
    syncedKeysCount: 1,
  }
);

/** `pause`/`resume`/`reset` for the whole query's clock. */
export const searchPolling = searchPoll.actions;

export const searchRegistry = createRegistry(createAsyncControl, searchPoll);
