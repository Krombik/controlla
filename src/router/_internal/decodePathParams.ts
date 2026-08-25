import decodeParam from '#router/internal/decodeParam';

/**
 * The url hands over what the address bar holds, so a param whose value is not
 * plain ascii arrives escaped - only when it comes from the url, which would
 * leave the same route parsing one thing on a deep link and another on a
 * navigation. Mutates the match's own groups.
 */
const decodePathParams = (params: Record<string, string>) => {
  const names = Object.keys(params);

  for (let i = 0; i < names.length; i++) {
    const name = names[i];

    const value = params[name];

    if (value !== undefined) {
      params[name] = decodeParam(value);
    }
  }

  return params;
};

export default decodePathParams;
