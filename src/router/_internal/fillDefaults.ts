import type { RouteData } from '#router/internal/types';

/**
 * A navigation target's params never run through `parse`, so a param declaring
 * a `defaultValue` would land as `undefined` when the target omits it - fill it
 * in, copying the target only once it actually has a gap.
 */
const fillDefaults = (route: RouteData, target: Record<string, any>) => {
  const defaults = route._defaults;

  const l = defaults.length;

  if (l) {
    const sourceValue = route._source && route._source._get();

    let filled = target;

    for (let i = 0; i < l; i += 2) {
      const key = defaults[i] as string;

      if (filled[key] === undefined) {
        if (filled == target) {
          filled = { ...target };
        }

        filled[key] = (defaults[i + 1] as (source: any) => any)(sourceValue);
      }
    }

    return filled;
  }

  return target;
};

export default fillDefaults;
