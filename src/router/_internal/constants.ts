export const ROUTE_METHODS = Symbol();

export const ROUTE_PARAMS = Symbol();

export const EMPTY_OBJECT = {};

export const ROUTE_HASH = Symbol();

/** Where `withPrefixes` leaves its list for `createRouter` to read. */
export const PREFIXES = Symbol();

export const ONCE_PASSIVE: AddEventListenerOptions = {
  passive: true,
  once: true,
};
