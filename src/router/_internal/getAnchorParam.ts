import type { PageRoute } from '#router/internal/types';

const getAnchorParam = (route: PageRoute<true>) => {
  const anchorParam = route._anchor;

  if (!anchorParam) {
    throw new Error('the route has no anchor');
  }

  return anchorParam;
};

export default getAnchorParam;
