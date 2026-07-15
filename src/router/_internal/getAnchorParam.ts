import type { PageRoute } from '#router/internal/types';

/** @internal resolves {@link route}'s `AnchorParam`, throwing if it has none */
const getAnchorParam = (route: PageRoute<true>) => {
  const anchorParam = route._anchor;

  if (!anchorParam) {
    throw new Error('the route has no anchor');
  }

  return anchorParam;
};

export default getAnchorParam;
