import type { Primitive } from 'keyweaver';

const map = new Map<Primitive, {}>();

/** A canonical object stand-in, so a primitive can key a WeakMap. */
const getObjectKey = (storageKey: Primitive) => {
  let token = map.get(storageKey);

  if (token === undefined) {
    map.set(storageKey, (token = {}));
  }

  return token;
};

export default getObjectKey;
