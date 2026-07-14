import type { HandleParse } from '#router/internal/types';

const simpleParse: HandleParse = (target, key, value) => {
  target[key] = value;
};

export default simpleParse;
