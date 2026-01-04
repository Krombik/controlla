import type { HandleParse } from '#_types';

const simpleParse: HandleParse = (target, key, value) => {
  target[key] = value;

  return false;
};

export default simpleParse;
