import type { Primitive } from 'keyweaver';

const map = new Map<Primitive, {}>();

const getObjectKey = (storageKey: Primitive) => {
  let token = map.get(storageKey);

  if (token === undefined) {
    map.set(storageKey, (token = {}));
  }

  return token;
};

export default getObjectKey;
