/** What `encodeURIComponent` leaves alone, plus the `/` an array param joins with. */
const IS_RAW = /[^A-Za-z0-9\-_.!~*'()/]/;

/**
 * Escapes a value on its way into the url, so what carries a `#`, a `?` or
 * anything non-ascii stays one segment of the path instead of ending it. The
 * `/` between an array param's items is the path's own, so it is left as it is.
 */
const encodePathValue = (value: string) =>
  IS_RAW.test(value) ? value.replace(/[^/]+/g, encodeURIComponent) : value;

export default encodePathValue;
