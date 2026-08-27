/**
 * The search page's controls, in their own module so that both halves of the
 * page can import them without importing each other.
 *
 * These stay module-level - globals, unlike the listing page's bag - because
 * everything here is URL-backed or derived from it, and the URL outlives any
 * mount. There is nothing per-instance to scope.
 */

import createDerivedControl from 'controlla/core/createDerivedControl';
import createBoundControl from 'controlla/core/createBoundControl';
import selectParams from 'controlla/router/selectParams';

import { searchRegistry } from '#controls/listings';
import { router } from '#router';

export const $params = selectParams(router.routes.search);

/**
 * The registry is keyed by this object. Deriving it - rather than assembling it
 * at each call site - means the key is one value with one identity, so every
 * component asking for "the current query" gets the same control.
 */
export const $query = createDerivedControl(
  $params.text,
  $params.remote,
  $params.seniority,
  (text, remoteOnly, seniority) => ({ text, remoteOnly, seniority })
);

/**
 * One control per (query, page) pair, following both. Change a filter and it
 * re-points at a different control; the previous one keeps its value in the
 * registry, so stepping back through history is instant.
 */
export const $results = createBoundControl(
  searchRegistry,
  $query,
  $params.page
);
