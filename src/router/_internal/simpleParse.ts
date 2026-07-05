import type { HandleParse } from '#router/internal/types';

const simpleParse: HandleParse = (target, key, value) => {
  target[key] = value;

  return false;
};

export default simpleParse;
