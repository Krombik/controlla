import { EMPTY_OBJECT } from '#router/internal/constants';

// a malformed escape is reachable from any pasted or crawled url, and it must
// not take the router down - browsers keep the raw text instead of throwing too
const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseSearch = (search: string): Record<string, string> => {
  if (search) {
    const params: Record<string, string> = {};

    for (let i = 1, l = search.length; i < l;) {
      const eq = search.indexOf('=', i) + 1;

      let end = search.indexOf('&', i);

      if (end < 0) {
        end = l;
      }

      if (eq && eq < end) {
        params[search.slice(i, eq - 1)] = decode(search.slice(eq, end));
      }

      i = end + 1;
    }

    return params;
  }

  return EMPTY_OBJECT;
};

export default parseSearch;
