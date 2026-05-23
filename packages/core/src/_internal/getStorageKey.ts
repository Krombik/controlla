import toKey, { type Primitive } from 'keyweaver';

const wm = new WeakMap<any, string>();

const getStorageKey = (value: any): Primitive => {
  if (value && typeof value == 'object') {
    let key = wm.get(value);

    if (key === undefined) {
      wm.set(value, (key = toKey(value)));
    }

    return key;
  }

  return value;
};

export default getStorageKey;
