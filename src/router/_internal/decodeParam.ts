/**
 * A malformed escape is reachable from any pasted or crawled url, and it must
 * not take the router down - browsers keep the raw text instead of throwing too.
 */
const decodeParam = (value: string) => {
  if (value.indexOf('%') < 0) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export default decodeParam;
